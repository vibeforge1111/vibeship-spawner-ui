import { logger } from '$lib/utils/logger';
/**
 * PRD Bridge - Write Endpoint
 *
 * Writes PRD content to a file for runtime analysis.
 * Called by Spawner UI when user uploads a PRD.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir, appendFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { sparkAgentBridge } from '$lib/services/spark-agent-bridge';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { resolveCliBinary } from '$lib/server/cli-resolver';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import { formatSkillsByCategory, getTierSkills, normalizeTier, type SkillTier } from '$lib/server/skill-tiers';
import { startClaudeAutoAnalysis } from '$lib/server/claude-auto-analysis';
import { classifyBrief, formatBundleForPrompt } from '$lib/server/bundle-classifier';
import { classifyMissionSize, formatMissionSizeGuidance } from '$lib/server/mission-size-classifier';
import { formatTaskQualityGuidance } from '$lib/server/task-quality-rubric';
import { formatVerificationPlanGuidance, generateVerificationPlan } from '$lib/server/verification-plan-generator';
import { enrichBrief } from '$lib/server/brief-enricher';

function getPrdBridgePaths() {
	const spawnerDir = process.env.SPAWNER_STATE_DIR || join(process.cwd(), '.spawner');
	return {
		spawnerDir,
		resultsDir: join(spawnerDir, 'results'),
		pendingPrdFile: join(spawnerDir, 'pending-prd.md'),
		pendingRequestFile: join(spawnerDir, 'pending-request.json'),
		prdAutoTraceFile: join(spawnerDir, 'prd-auto-trace.jsonl')
	};
}
const AUTO_ANALYSIS_BASE_URL = (process.env.SPAWNER_UI_SELF_URL || 'http://127.0.0.1:3333').replace(
	/\/+$/,
	''
);
const AUTO_ANALYSIS_ENDPOINT = `${AUTO_ANALYSIS_BASE_URL}/api/events`;
const DEFAULT_AUTO_ANALYSIS_TIMEOUT_MS = 180_000;
const configuredAnalysisTimeoutMs = Number.parseInt(process.env.SPAWNER_AUTO_ANALYSIS_TIMEOUT_MS || '', 10);
const AUTO_ANALYSIS_TIMEOUT_MS =
	Number.isFinite(configuredAnalysisTimeoutMs) && configuredAnalysisTimeoutMs > 0
		? configuredAnalysisTimeoutMs
		: DEFAULT_AUTO_ANALYSIS_TIMEOUT_MS;

function normalizeRequestId(requestId: string): string {
	return requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function missionIdFromRequestId(requestId: string): string {
	const normalized = normalizeRequestId(requestId);
	const stamp = normalized.match(/(\d{10,})$/)?.[1];
	return `mission-${stamp || normalized}`;
}

async function appendPrdTrace(requestId: string, event: string, details: Record<string, unknown> = {}): Promise<void> {
	try {
		const { prdAutoTraceFile } = getPrdBridgePaths();
		const row = {
			ts: new Date().toISOString(),
			requestId,
			event,
			...details
		};
		await appendFile(prdAutoTraceFile, `${JSON.stringify(row)}\n`, 'utf-8');
	} catch {
		// Never fail request flow on trace write.
	}
}

async function updatePendingRequestStatus(
	requestId: string,
	status: 'pending' | 'processed' | 'timeout' | 'error',
	extra: Record<string, unknown> = {}
): Promise<void> {
	try {
		const { pendingRequestFile } = getPrdBridgePaths();
		if (!existsSync(pendingRequestFile)) return;
		const raw = await readFile(pendingRequestFile, 'utf-8');
		const current = JSON.parse(raw) as Record<string, unknown>;
		if (current.requestId !== requestId) return;

		const next = {
			...current,
			status,
			updatedAt: new Date().toISOString(),
			...extra
		};
		await writeFile(pendingRequestFile, JSON.stringify(next, null, 2), 'utf-8');
	} catch {
		// Keep analysis flow alive even if status updates fail.
	}
}

function slugifyTaskId(value: string, fallback: string): string {
	const slug = value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
	return slug || fallback;
}

function extractTargetFolder(content: string): string | null {
	const match = content.match(/\bat\s+([A-Za-z]:\\[^\n\r]+?)(?::\s|\s+Files\b|$|\r|\n)/i);
	return match?.[1]?.trim().replace(/[.:]+$/, '') || null;
}

function extractRequestedFiles(content: string): string[] {
	const fileNames = new Set<string>();
	const filePattern = /\b[\w.-]+\.(?:html|css|js|ts|tsx|json|md|py|svelte|vue|jsx)\b/gi;
	for (const match of content.matchAll(filePattern)) {
		fileNames.add(match[0]);
	}
	return [...fileNames].slice(0, 12);
}

function inferTechStack(content: string): { framework: string; language: string; styling: string; deployment: string } {
	const lower = content.toLowerCase();
	if (lower.includes('three.js') || lower.includes('threejs')) {
		return {
			framework: 'Vanilla JavaScript + Three.js',
			language: 'JavaScript',
			styling: 'CSS',
			deployment: 'Static file hosting'
		};
	}
	if (lower.includes('vanilla-js') || lower.includes('vanilla js') || lower.includes('no build step')) {
		return {
			framework: 'Vanilla JavaScript',
			language: 'JavaScript',
			styling: 'CSS',
			deployment: 'Direct static launch'
		};
	}
	if (lower.includes('svelte')) {
		return {
			framework: 'SvelteKit',
			language: 'TypeScript',
			styling: 'CSS',
			deployment: 'Node adapter or static deployment'
		};
	}
	return {
		framework: 'Web app',
		language: 'TypeScript or JavaScript',
		styling: 'CSS',
		deployment: 'Local development server'
	};
}

export async function _buildFallbackAnalysisResult(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd',
	tier: SkillTier,
	paths: ReturnType<typeof getPrdBridgePaths>
): Promise<Record<string, unknown>> {
	const content = existsSync(paths.pendingPrdFile) ? await readFile(paths.pendingPrdFile, 'utf-8') : '';
	const targetFolder = extractTargetFolder(content);
	const requestedFiles = extractRequestedFiles(content);
	const techStack = inferTechStack(content);
	const lower = content.toLowerCase();
	const isStaticApp = lower.includes('no build step') || lower.includes('vanilla-js') || lower.includes('vanilla js');
	const isThree = lower.includes('three.js') || lower.includes('threejs');
	const skillByTheme = isThree
		? ['frontend-engineer', 'threejs-3d-graphics', 'ui-design', 'responsive-mobile-first']
		: ['frontend-engineer', 'ui-design', 'responsive-mobile-first', 'state-management'];
	const validSkills = new Set((await getTierSkills(tier)).map((skill) => skill.id));
	const selectSkills = (skills: string[]) => skills.filter((skill) => validSkills.has(skill)).slice(0, 5);
	const workspaceTargets = targetFolder ? [targetFolder] : [];
	const fileList = requestedFiles.length > 0 ? requestedFiles.join(', ') : 'the requested project files';

	const taskSpecs = [
		{
			title: isStaticApp ? 'Create the static app shell' : 'Create the app shell and project structure',
			summary: `Set up ${fileList} and make the first screen match the requested product direction.`,
			skills: selectSkills(['frontend-engineer', 'html-css', 'ui-design', 'responsive-mobile-first']),
			dependencies: [] as string[],
			acceptanceCriteria: [
				'The project opens to a usable first screen.',
				'Requested files and local project structure are present.',
				'No unrelated framework or build tooling is added when the brief says no build step.'
			],
			verificationCommands: targetFolder
				? [`Test-Path '${targetFolder}'`, `Get-ChildItem '${targetFolder}' | Select-Object -ExpandProperty Name`]
				: ['Inspect the created project files.']
		},
		{
			title: isThree ? 'Implement the interactive 3D scene and controls' : 'Implement the core interaction and state',
			summary: isThree
				? 'Build the animated Three.js experience, primary controls, and responsive fallback behavior.'
				: 'Build the main user flow, controls, live status/progress, persistence, and reset or completion behavior.',
			skills: selectSkills(skillByTheme),
			dependencies: ['task-1'],
			acceptanceCriteria: [
				'The core workflow can be completed from the first screen.',
				'Interactive state updates immediately and persists where requested.',
				'Controls remain usable on desktop and mobile widths.'
			],
			verificationCommands: targetFolder
				? [`Select-String -Path '${targetFolder}\\app.js' -Pattern 'localStorage'`]
				: ['Run the project interaction smoke test.']
		},
		{
			title: 'Polish the visual system and documentation',
			summary: 'Finish the dark operational UI, responsive details, accessibility basics, and README smoke test.',
			skills: selectSkills(['ui-design', 'accessibility', 'technical-writer', 'documentation-that-slaps']),
			dependencies: ['task-1'],
			acceptanceCriteria: [
				'The UI is readable, responsive, and visually consistent.',
				'README explains direct launch and a manual smoke test.',
				'The implementation documents any fallback or browser requirement.'
			],
			verificationCommands: targetFolder
				? [`Test-Path '${targetFolder}\\README.md'`, `Get-Content '${targetFolder}\\README.md'`]
				: ['Read the README and perform the documented smoke test.']
		},
		{
			title: 'Verify the completed build',
			summary: 'Run the requested lightweight checks and confirm the finished project matches the brief.',
			skills: selectSkills(['qa-engineering', 'testing-strategies', 'test-architect']),
			dependencies: ['task-2', 'task-3'],
			acceptanceCriteria: [
				'Static syntax checks pass where applicable.',
				'The requested completion state or primary success path works.',
				'The final project can be opened locally.'
			],
			verificationCommands: targetFolder
				? [
						...(requestedFiles.includes('app.js') ? [`node --check '${targetFolder}\\app.js'`] : []),
						`Get-ChildItem '${targetFolder}' | Select-Object -ExpandProperty Name`
					]
				: ['Run the repo-local verification commands.']
		}
	];

	const tasks = taskSpecs.map((task, index) => {
		const id = slugifyTaskId(task.title, `task-${index + 1}`);
		const dependencyIds = task.dependencies.map((dependency, depIndex) => {
			if (dependency === 'task-1') return slugifyTaskId(taskSpecs[0].title, 'task-1');
			if (dependency === 'task-2') return slugifyTaskId(taskSpecs[1].title, 'task-2');
			if (dependency === 'task-3') return slugifyTaskId(taskSpecs[2].title, 'task-3');
			return slugifyTaskId(dependency, `task-${depIndex + 1}`);
		});
		return {
			id,
			title: task.title,
			summary: task.summary,
			description: task.summary,
			skills: task.skills.length > 0 ? task.skills : selectSkills(['frontend-engineer']),
			dependencies: dependencyIds,
			workspaceTargets,
			acceptanceCriteria: task.acceptanceCriteria,
			verificationCommands: task.verificationCommands
		};
	});

	const skills = [...new Set(tasks.flatMap((task) => task.skills as string[]))];

	return {
		requestId,
		success: true,
		projectName,
		projectType: isStaticApp ? 'static-web-app' : 'web-app',
		complexity: buildMode === 'advanced_prd' ? 'moderate' : 'simple',
		infrastructure: {
			needsAuth: false,
			authReason: 'Not requested for v1.',
			needsDatabase: false,
			databaseReason: 'Use local files/browser persistence for v1 unless the brief requires a backend.',
			needsAPI: false,
			apiReason: 'No backend API required by the brief.'
		},
		techStack,
		tasks,
		skills,
		executionPrompt: `Build ${projectName} from the user brief. Preserve explicit file, no-build, persistence, and smoke-test requirements.`
	};
}

async function writeFallbackAnalysisResult(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd',
	tier: SkillTier,
	reason: string
): Promise<void> {
	const paths = getPrdBridgePaths();
	const safeRequestId = normalizeRequestId(requestId);
	const resultFile = join(paths.resultsDir, `${safeRequestId}.json`);
	if (existsSync(resultFile)) return;

	if (!existsSync(paths.resultsDir)) {
		await mkdir(paths.resultsDir, { recursive: true });
	}

	const result = await _buildFallbackAnalysisResult(requestId, projectName, buildMode, tier, paths);
	await writeFile(resultFile, JSON.stringify(result, null, 2), 'utf-8');
	await appendPrdTrace(requestId, 'fallback_analysis_written', {
		reason,
		resultFile,
		taskCount: Array.isArray(result.tasks) ? result.tasks.length : 0
	});
}

function scheduleAutoAnalysisWatchdog(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd',
	tier: SkillTier,
	cancelAutoAnalysis?: () => void
): void {
	if (AUTO_ANALYSIS_TIMEOUT_MS <= 0) return;
	const timer = setTimeout(async () => {
		const { resultsDir } = getPrdBridgePaths();
		const safeRequestId = normalizeRequestId(requestId);
		const resultFile = join(resultsDir, `${safeRequestId}.json`);
		const hasResult = existsSync(resultFile);
		if (hasResult) {
			await appendPrdTrace(requestId, 'watchdog_result_found');
			return;
		}

		cancelAutoAnalysis?.();
		await updatePendingRequestStatus(requestId, 'timeout', {
			timeoutMs: AUTO_ANALYSIS_TIMEOUT_MS,
			reason: 'No runtime analysis result written before timeout; deterministic fallback queued'
		});
		await appendPrdTrace(requestId, 'watchdog_timeout', {
			timeoutMs: AUTO_ANALYSIS_TIMEOUT_MS,
			expectedResultFile: resultFile
		});
		await writeFallbackAnalysisResult(
			requestId,
			projectName,
			buildMode,
			tier,
			`auto-analysis timeout after ${AUTO_ANALYSIS_TIMEOUT_MS}ms`
		);
	}, AUTO_ANALYSIS_TIMEOUT_MS);

	if (typeof timer.unref === 'function') {
		timer.unref();
	}
}

function resolveCodexBinary(): string | null {
	return resolveCliBinary('codex');
}

function normalizeBuildMode(value: unknown): 'direct' | 'advanced_prd' {
	return value === 'advanced_prd' ? 'advanced_prd' : 'direct';
}

function isConcreteDirectStaticBuild(content: string): boolean {
	const lower = content.toLowerCase();
	const hasStaticSurface = /\b(?:static|vanilla|single[- ]page|landing\s+page|html|css|javascript|no build step)\b/.test(lower);
	const hasDeliverable = /\b(?:build|create|make|ship|scaffold|generate)\b/.test(lower) && /\b(?:page|site|app|website)\b/.test(lower);
	const hasFeatureSignal = /\b(?:menu|section|hero|gallery|contact|pricing|form|cards?|responsive|button|navigation|localstorage)\b/.test(lower);
	return hasStaticSurface && hasDeliverable && hasFeatureSignal;
}

export function _shouldRequestBriefClarification(input: {
	content: string;
	buildMode: 'direct' | 'advanced_prd';
	openQuestions: string[];
	forceDispatch?: boolean;
}): boolean {
	if (input.forceDispatch) return false;
	if (input.openQuestions.length === 0) return false;
	if (input.content.length >= 400) return false;
	if (input.buildMode === 'direct' && isConcreteDirectStaticBuild(input.content)) return false;
	return true;
}

function normalizeTelegramRelay(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const raw = value as Record<string, unknown>;
	const relay: Record<string, unknown> = {};
	if (typeof raw.profile === 'string' && raw.profile.trim()) {
		relay.profile = raw.profile.trim();
	}
	if (typeof raw.url === 'string' && raw.url.trim()) {
		relay.url = raw.url.trim();
	}
	const port = typeof raw.port === 'number' ? raw.port : typeof raw.port === 'string' ? Number(raw.port.trim()) : NaN;
	if (Number.isFinite(port) && port > 0) {
		relay.port = Math.trunc(port);
	}
	return Object.keys(relay).length > 0 ? relay : undefined;
}

async function buildPromptParts(
	buildMode: 'direct' | 'advanced_prd',
	tier: SkillTier,
	briefBody?: string
): Promise<{
	planningContract: string;
	tierBlock: string;
	workflowGuidance: string;
	bundleBlock: string;
	missionSizeBlock: string;
}> {
	const planningContract =
		buildMode === 'advanced_prd'
			? [
					'Advanced build contract:',
					'- Treat the PRD content as the source request and turn it into a compact PRD before tasking.',
					'- Use the Founder UI pattern: summary, objective, scope, non-goals, target UX, technical constraints, phased task plan, exit criteria.',
					'- Convert the PRD into TAS-style tasks: each task needs acceptance criteria, dependencies, file/workspace targets, and verification commands.',
					'- Choose task count from the actual work. Tiny builds may use 3-4 tasks, normal apps usually need 5-8, and substantial projects may need 8-14.',
					'- Do not default to four tasks. Split work by distinct skill sets, real dependencies, and verification boundaries.',
					'- Preserve explicit user constraints such as "No build step" or exact file lists.'
				].join('\n')
			: [
					'Direct build contract:',
					'- Preserve the user request as-is and create only the tasks needed to execute it.',
					'- Do not inflate small explicit builds into a broad product plan.'
				].join('\n');

	const tierSkills = await getTierSkills(tier);
	const tierIds = tierSkills.map((s) => s.id).sort();
	const tierBlock =
		tier === 'base'
			? [
					`User skill tier: BASE (${tierIds.length} skills available)`,
					'',
					'Each task\'s "skills" array MUST contain only IDs from this allowlist:',
					tierIds.join(', '),
					'',
					'If no listed skill fits a task, pick the closest match. Do NOT invent IDs.',
					'Do NOT use pro-only IDs like "phaser-3", "vite-project-setup", "smart-contract-auditor", or "react-native-specialist" on a base build — they are not licensed for this user.'
				].join('\n')
			: [
					`User skill tier: PRO (${tierIds.length} skills available, full spark-skill-graphs catalog)`,
					'',
					'Each task\'s "skills" array MUST contain only valid IDs from spark-skill-graphs.',
					'Pick 1-5 specific skills per task — prefer specialists over generalists.',
					'Available IDs grouped by category:',
					formatSkillsByCategory(tierSkills),
					'',
					'Do NOT invent IDs. Do NOT use shorthand like "frontend" when "frontend-engineer" or a more specific specialist exists.'
				].join('\n');

	const workflowGuidance = [
		'Workflow shape requirements:',
		'- Tasks must form a DAG. Set dependencies only when a task TRULY blocks another.',
		'- Independent tasks must run in parallel — do NOT add a dependency just to make the graph linear.',
		'- A 6-task plan should usually have 2-3 dependency layers, not 6.',
		'- Each task needs at least one acceptance criterion and one verification command.',
		'',
		formatTaskQualityGuidance()
	].join('\n');

	let bundleBlock = '';
	let missionSizeBlock = '';
	if (briefBody) {
		const missionSizeClassification = classifyMissionSize(briefBody);
		missionSizeBlock = [
			formatMissionSizeGuidance(missionSizeClassification),
			'',
			formatVerificationPlanGuidance(generateVerificationPlan(missionSizeClassification))
		].join('\n');
		try {
			const classification = await classifyBrief(briefBody);
			if (classification.bestMatch) {
				bundleBlock = formatBundleForPrompt(classification.bestMatch);
				logger.info(
					`[PRDBridge] bundle classifier: ${classification.bestMatch.id} confidence=${classification.confidence.toFixed(2)}`
				);
			} else {
				logger.info('[PRDBridge] bundle classifier: no match above threshold');
			}
		} catch (err) {
			console.warn('[PRDBridge] bundle classifier failed:', err);
		}
	}

	return { planningContract, tierBlock, workflowGuidance, bundleBlock, missionSizeBlock };
}

async function buildCodexPrompt(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd',
	tier: SkillTier,
	paths: ReturnType<typeof getPrdBridgePaths>,
	bundleBlock?: string,
	missionSizeBlock?: string
): Promise<string> {
	const planningContract =
		buildMode === 'advanced_prd'
			? [
					'Advanced build contract:',
					'- Treat .spawner/pending-prd.md as the source request and turn it into a compact PRD before tasking.',
					'- Use the Founder UI pattern: summary, objective, scope, non-goals, target UX, technical constraints, phased task plan, exit criteria.',
					'- Convert the PRD into TAS-style tasks: each task needs acceptance criteria, dependencies, file/workspace targets, and verification commands.',
					'- Choose task count from the actual work. Tiny builds may use 3-4 tasks, normal apps usually need 5-8, and substantial projects may need 8-14.',
					'- Do not default to four tasks. Split work by distinct skill sets, real dependencies, and verification boundaries.',
					'- Preserve explicit user constraints such as "No build step" or exact file lists.'
				].join('\n')
			: [
					'Direct build contract:',
					'- Preserve the user request as-is and create only the tasks needed to execute it.',
					'- Do not inflate small explicit builds into a broad product plan.'
				].join('\n');

	const tierSkills = await getTierSkills(tier);
	const tierIds = tierSkills.map((s) => s.id).sort();
	const tierBlock =
		tier === 'base'
			? [
					`User skill tier: BASE (${tierIds.length} skills available)`,
					'',
					'Each task\'s "skills" array MUST contain only IDs from this allowlist:',
					tierIds.join(', '),
					'',
					'If no listed skill fits a task, pick the closest match. Do NOT invent IDs.',
					'Do NOT use pro-only IDs like "phaser-3", "vite-project-setup", "smart-contract-auditor", or "react-native-specialist" on a base build — they are not licensed for this user.'
				].join('\n')
			: [
					`User skill tier: PRO (${tierIds.length} skills available, full spark-skill-graphs catalog)`,
					'',
					'Each task\'s "skills" array MUST contain only valid IDs from spark-skill-graphs.',
					'Pick 1-5 specific skills per task — prefer specialists over generalists.',
					'Available IDs grouped by category:',
					formatSkillsByCategory(tierSkills),
					'',
					'Do NOT invent IDs. Do NOT use shorthand like "frontend" when "frontend-engineer" or a more specific specialist exists.'
				].join('\n');

	const workflowGuidance = [
		'Workflow shape requirements:',
		'- Tasks must form a DAG. Set dependencies only when a task TRULY blocks another.',
		'- Independent tasks must run in parallel — do NOT add a dependency just to make the graph linear.',
		'- A 6-task plan should usually have 2-3 dependency layers, not 6.',
		'- Each task needs at least one acceptance criterion and one verification command.',
		'',
		formatTaskQualityGuidance()
	].join('\n');

	return [
		'You are running inside spawner-ui and must complete PRD analysis autonomously.',
		`Request ID: ${requestId}`,
		`Project Name Hint: ${projectName}`,
		`Build Mode: ${buildMode}`,
		'',
		planningContract,
		'',
		tierBlock,
		'',
		workflowGuidance,
		'',
		...(missionSizeBlock ? [missionSizeBlock, ''] : []),
		...(bundleBlock ? [bundleBlock, ''] : []),
		'Configured bridge paths:',
		`- State directory: ${paths.spawnerDir}`,
		`- Pending request metadata: ${paths.pendingRequestFile}`,
		`- Pending PRD: ${paths.pendingPrdFile}`,
		`- Results directory: ${paths.resultsDir}`,
		'',
		'Execution steps (strict):',
		'1) Read the pending request metadata path above and confirm requestId matches.',
		'2) Read the pending PRD path above completely.',
		'3) Produce a valid PRD analysis result JSON with:',
		'   requestId, success, projectName, projectType, complexity, infrastructure, techStack, tasks, skills, executionPrompt.',
		'4) Include actionable tasks with skills, dependencies, and verification criteria. For advanced_prd, make these TAS-style tasks with acceptance criteria.',
		'5) Validate every skill ID before emitting — if it is not in the allowlist above, replace it with the closest valid ID or omit the task.',
		'6) POST result event to Spawner API via PowerShell Invoke-RestMethod using this shape:',
		`   {"type":"prd_analysis_complete","data":{"requestId":"${requestId}","result":<analysis>},"source":"codex-auto"}`,
		`   URL: ${AUTO_ANALYSIS_ENDPOINT}`,
		'7) If any failure happens, POST {"type":"prd_analysis_error", ...} with the same requestId.',
		'',
		'Hard constraints:',
		'- Do not wait for human input.',
		'- Do not leave placeholders.',
		'- Ensure posted JSON is complete and parseable.',
		'- Skill IDs MUST come from the allowlist. This is non-negotiable.',
		'- Choose task count from project complexity. Do not default to four tasks when distinct skill sets or verification boundaries justify more.',
		'',
		'When finished successfully, print exactly: PRD_ANALYSIS_SENT'
	].join('\n');
}

async function startAutoAnalysis(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd',
	tier: SkillTier
): Promise<{ started: boolean; provider: string; cancel?: () => void }> {
	const provider = (
		process.env.SPAWNER_PRD_AUTO_PROVIDER ||
		process.env.SPARK_MISSION_LLM_PROVIDER ||
		process.env.DEFAULT_MISSION_PROVIDER ||
		'codex'
	).trim().toLowerCase();
	if (provider === 'none') {
		await appendPrdTrace(requestId, 'auto_disabled', { provider });
		return { started: false, provider };
	}

	if (provider === 'claude') {
		const paths = getPrdBridgePaths();
		const briefBody = existsSync(paths.pendingPrdFile)
			? await readFile(paths.pendingPrdFile, 'utf-8')
			: undefined;
		const parts = await buildPromptParts(buildMode, tier, briefBody);
		const started = await startClaudeAutoAnalysis({
			requestId,
			projectName,
			buildMode,
			tier,
			paths,
			...parts,
			appendTrace: (event, details) => appendPrdTrace(requestId, event, details)
		});
		return { started, provider: 'claude' };
	}

	if (provider !== 'codex') {
		await appendPrdTrace(requestId, 'auto_unsupported_provider', { provider });
		return { started: false, provider };
	}

	try {
		const codexBinary = resolveCodexBinary();
		if (!codexBinary) {
			await appendPrdTrace(requestId, 'auto_binary_missing', { provider: 'codex' });
			return { started: false, provider: 'codex' };
		}

		const paths = getPrdBridgePaths();
		const briefBody = existsSync(paths.pendingPrdFile)
			? await readFile(paths.pendingPrdFile, 'utf-8')
			: undefined;
		const parts = await buildPromptParts(buildMode, tier, briefBody);
		const prompt = await buildCodexPrompt(
			requestId,
			projectName,
			buildMode,
			tier,
			paths,
			parts.bundleBlock,
			parts.missionSizeBlock
		);
		const missionId = `prd-auto-${normalizeRequestId(requestId)}`;

		await appendPrdTrace(requestId, 'auto_worker_dispatch', {
			provider: 'codex',
			missionId,
			workingDirectory: process.cwd(),
			stateDirectory: paths.spawnerDir
		});

		const controller = new AbortController();
		void sparkAgentBridge
			.executeProviderTask({
				providerId: 'codex',
				missionId,
				prompt,
				model: 'gpt-5.5',
				commandTemplate: 'codex exec --yolo',
				workingDirectory: process.cwd(),
				signal: controller.signal
			})
			.then((result) => {
				void appendPrdTrace(requestId, 'auto_worker_finished', {
					success: result.success,
					error: result.error || null,
					durationMs: result.durationMs || null,
					sessionId: result.sparkAgentSessionId
				});
			})
			.catch((error: unknown) => {
				void appendPrdTrace(requestId, 'auto_worker_error', {
					error: error instanceof Error ? error.message : String(error)
				});
			});

		return {
			started: true,
			provider: 'codex',
			cancel: () => controller.abort()
		};
	} catch (error) {
		await appendPrdTrace(requestId, 'auto_start_failed', {
			provider: 'codex',
			error: error instanceof Error ? error.message : String(error)
		});
		return { started: false, provider: 'codex' };
	}
}

export const POST: RequestHandler = async (event) => {
	try {
		const unauthorized = requireControlAuth(event, {
			surface: 'PRDBridgeWrite',
			apiKeyEnvVar: 'SPAWNER_PRD_API_KEY',
			fallbackApiKeyEnvVar: 'MCP_API_KEY',
			apiKeyQueryParam: 'apiKey',
			apiKeyCookieName: 'spawner_events_api_key',
			allowLoopbackWithoutKey: true,
			allowedOriginsEnvVar: 'SPAWNER_ALLOWED_ORIGINS'
		});
		if (unauthorized) return unauthorized;

		const rateLimited = enforceRateLimit(event, {
			scope: 'prd_bridge_write',
			limit: 20,
			windowMs: 60_000
		});
		if (rateLimited) return rateLimited;

		const { content, requestId, projectName, options, chatId, userId, buildMode, buildModeReason, telegramRelay, tier, forceDispatch } =
			await event.request.json();
		const normalizedBuildMode = normalizeBuildMode(buildMode);
		const normalizedTier = normalizeTier(tier);
		const normalizedTelegramRelay = normalizeTelegramRelay(telegramRelay);
		const skipClarification = forceDispatch === true;
		const paths = getPrdBridgePaths();

		if (!content || !requestId) {
			return json({ error: 'Content and requestId are required' }, { status: 400 });
		}

		// Ensure .spawner directory exists
		if (!existsSync(paths.spawnerDir)) {
			await mkdir(paths.spawnerDir, { recursive: true });
		}
		if (!existsSync(paths.resultsDir)) {
			await mkdir(paths.resultsDir, { recursive: true });
		}

		// Brief enrichment: lift a vague brief into something the canvas
		// generator can actually plan against. Skipped when the input is
		// already specific enough (length / keyword density / has section
		// headers). Always returns a safe enrichedContent — never blocks.
		const enrichment = await enrichBrief(content);
		const finalContent = enrichment.enrichedContent;
		if (enrichment.wasEnriched) {
			await appendPrdTrace(requestId, 'brief_enriched', {
				originalLength: content.length,
				enrichedLength: finalContent.length,
				addedAssumptions: enrichment.addedAssumptions,
				openQuestions: enrichment.openQuestions
			});
		}

		// Clarification gate: if the enricher surfaced open questions on a
		// short brief, return needsClarification:true so the caller (bot)
		// can ask the user before we burn an LLM dispatch on a vague input.
		// forceDispatch:true bypasses (used when the bot re-dispatches with
		// answers).
		if (_shouldRequestBriefClarification({
			content,
			buildMode: normalizedBuildMode,
			openQuestions: enrichment.openQuestions || [],
			forceDispatch: skipClarification
		})) {
			await appendPrdTrace(requestId, 'clarification_requested', {
				questionCount: enrichment.openQuestions.length,
				briefLength: content.length
			});
			// Persist the original + enriched content so the bot can re-dispatch
			// with answers later via forceDispatch.
			const pendingClarFile = join(paths.spawnerDir, 'pending-clarifications', `${normalizeRequestId(requestId)}.json`);
			await mkdir(join(paths.spawnerDir, 'pending-clarifications'), { recursive: true });
			await writeFile(
				pendingClarFile,
				JSON.stringify({
					requestId,
					projectName: projectName || 'Untitled Project',
					originalContent: content,
					enrichedContent: finalContent,
					addedAssumptions: enrichment.addedAssumptions,
					openQuestions: enrichment.openQuestions,
					tier: normalizedTier,
					buildMode: normalizedBuildMode,
					timestamp: new Date().toISOString()
				}, null, 2),
				'utf-8'
			);
			return json({
				success: true,
				needsClarification: true,
				requestId,
				openQuestions: enrichment.openQuestions,
				addedAssumptions: enrichment.addedAssumptions,
				message: 'Brief is too thin to plan against confidently. Answer the questions and re-submit with forceDispatch:true to bypass.'
			});
		}

		// Write the (possibly enriched) PRD content to file
		await writeFile(paths.pendingPrdFile, finalContent, 'utf-8');
		const missionId = missionIdFromRequestId(requestId);

		// Write request metadata
		const requestMeta = {
			requestId,
			missionId,
			projectName: projectName || 'Untitled Project',
			buildMode: normalizedBuildMode,
			buildModeReason:
				typeof buildModeReason === 'string' && buildModeReason.trim()
					? buildModeReason.trim()
					: normalizedBuildMode === 'advanced_prd'
						? 'Advanced PRD planning requested.'
						: 'Direct build requested.',
			timestamp: new Date().toISOString(),
			prdPath: paths.pendingPrdFile,
			status: 'pending',
			options: {
				includeSkills: options?.includeSkills !== false,
				includeMCPs: options?.includeMCPs !== false
			},
			relay:
				typeof chatId === 'string' && chatId.trim()
					? {
							chatId: chatId.trim(),
							userId: typeof userId === 'string' && userId.trim() ? userId.trim() : 'telegram',
							missionId,
							requestId,
							goal: content.slice(0, 500),
							...(normalizedTelegramRelay ? { telegramRelay: normalizedTelegramRelay } : {})
						}
					: undefined
		};
		await writeFile(paths.pendingRequestFile, JSON.stringify(requestMeta, null, 2), 'utf-8');
		await appendPrdTrace(requestId, 'request_written', {
			projectName: requestMeta.projectName,
			buildMode: requestMeta.buildMode
		});
		void relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			missionName: requestMeta.projectName,
			taskName: 'Preparing canvas',
			message: 'Spark is shaping the PRD and preparing the canvas.',
			source: 'prd-bridge',
			data: {
				requestId,
				buildMode: requestMeta.buildMode,
				buildModeReason: requestMeta.buildModeReason,
				...(normalizedTelegramRelay ? { telegramRelay: normalizedTelegramRelay } : {})
			}
		});

		const auto = await startAutoAnalysis(
			requestId,
			requestMeta.projectName,
			requestMeta.buildMode,
			normalizedTier
		);
		if (auto.started) {
			scheduleAutoAnalysisWatchdog(
				requestId,
				requestMeta.projectName,
				requestMeta.buildMode,
				normalizedTier,
				auto.cancel
			);
		}

		logger.info(`[PRDBridge] PRD written to ${paths.pendingPrdFile}`);
		logger.info(`[PRDBridge] Request ID: ${requestId}`);
		logger.info(`[PRDBridge] Auto-analysis (${auto.provider}): ${auto.started ? 'started' : 'not-started'}`);

		return json({
			success: true,
			path: paths.pendingPrdFile,
			requestId,
			autoAnalysis: {
				provider: auto.provider,
				started: auto.started
			},
			enrichment: {
				wasEnriched: enrichment.wasEnriched,
				addedAssumptions: enrichment.addedAssumptions,
				openQuestions: enrichment.openQuestions
			}
		});
	} catch (error) {
		console.error('[PRDBridge] Error writing PRD:', error);
		return json({ error: 'Failed to write PRD file' }, { status: 500 });
	}
};
