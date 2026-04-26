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
import { openclawBridge } from '$lib/services/openclaw-bridge';
import { enforceRateLimit, requireControlAuth } from '$lib/server/mcp-auth';
import { resolveCliBinary } from '$lib/server/cli-resolver';

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
const AUTO_ANALYSIS_ENDPOINT = process.env.SPAWNER_UI_SELF_URL
  ? `${process.env.SPAWNER_UI_SELF_URL.replace(/\/+$/, '')}/api/events`
  : 'http://127.0.0.1:4174/api/events';
const AUTO_ANALYSIS_TIMEOUT_MS = 55_000;

function normalizeRequestId(requestId: string): string {
	return requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
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

function scheduleAutoAnalysisWatchdog(requestId: string): void {
	const timer = setTimeout(async () => {
		const { resultsDir } = getPrdBridgePaths();
		const safeRequestId = normalizeRequestId(requestId);
		const resultFile = join(resultsDir, `${safeRequestId}.json`);
		const hasResult = existsSync(resultFile);
		if (hasResult) {
			await appendPrdTrace(requestId, 'watchdog_result_found');
			return;
		}

		await updatePendingRequestStatus(requestId, 'timeout', {
			timeoutMs: AUTO_ANALYSIS_TIMEOUT_MS,
			reason: 'No runtime analysis result written before timeout'
		});
		await appendPrdTrace(requestId, 'watchdog_timeout', {
			timeoutMs: AUTO_ANALYSIS_TIMEOUT_MS,
			expectedResultFile: resultFile
		});
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

function buildCodexPrompt(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd',
	paths: ReturnType<typeof getPrdBridgePaths>
): string {
	const planningContract =
		buildMode === 'advanced_prd'
			? [
					'Advanced build contract:',
					'- Treat .spawner/pending-prd.md as the source request and turn it into a compact PRD before tasking.',
					'- Use the Founder UI pattern: summary, objective, scope, non-goals, target UX, technical constraints, phased task plan, exit criteria.',
					'- Convert the PRD into TAS-style tasks: each task needs acceptance criteria, dependencies, file/workspace targets, and verification commands.',
					'- Keep task count practical. Prefer 3-8 high-signal implementation tasks over many tiny chores.',
					'- Preserve explicit user constraints such as "No build step" or exact file lists.'
				].join('\n')
			: [
					'Direct build contract:',
					'- Preserve the user request as-is and create only the tasks needed to execute it.',
					'- Do not inflate small explicit builds into a broad product plan.'
				].join('\n');

	return [
		'You are running inside spawner-ui and must complete PRD analysis autonomously.',
		`Request ID: ${requestId}`,
		`Project Name Hint: ${projectName}`,
		`Build Mode: ${buildMode}`,
		'',
		planningContract,
		'',
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
		'5) POST result event to Spawner API via PowerShell Invoke-RestMethod using this shape:',
		`   {"type":"prd_analysis_complete","data":{"requestId":"${requestId}","result":<analysis>},"source":"codex-auto"}`,
		`   URL: ${AUTO_ANALYSIS_ENDPOINT}`,
		'6) If any failure happens, POST {"type":"prd_analysis_error", ...} with the same requestId.',
		'',
		'Hard constraints:',
		'- Do not wait for human input.',
		'- Do not leave placeholders.',
		'- Ensure posted JSON is complete and parseable.',
		'',
		'When finished successfully, print exactly: PRD_ANALYSIS_SENT'
	].join('\n');
}

async function startCodexAutoAnalysis(
	requestId: string,
	projectName: string,
	buildMode: 'direct' | 'advanced_prd'
): Promise<boolean> {
	const provider = (process.env.SPAWNER_PRD_AUTO_PROVIDER || 'codex').trim().toLowerCase();
	if (provider === 'none') {
		await appendPrdTrace(requestId, 'auto_disabled', { provider });
		return false;
	}

	if (provider !== 'codex') {
		await appendPrdTrace(requestId, 'auto_unsupported_provider', { provider });
		return false;
	}

	try {
		const codexBinary = resolveCodexBinary();
		if (!codexBinary) {
			await appendPrdTrace(requestId, 'auto_binary_missing', { provider: 'codex' });
			return false;
		}

		const paths = getPrdBridgePaths();
		const prompt = buildCodexPrompt(requestId, projectName, buildMode, paths);
		const missionId = `prd-auto-${normalizeRequestId(requestId)}`;

		await appendPrdTrace(requestId, 'auto_worker_dispatch', {
			provider: 'codex',
			missionId,
			workingDirectory: process.cwd(),
			stateDirectory: paths.spawnerDir
		});

		void openclawBridge
			.executeProviderTask({
				providerId: 'codex',
				missionId,
				prompt,
				model: 'gpt-5.5',
				commandTemplate: 'codex exec --yolo',
				workingDirectory: process.cwd()
			})
			.then((result) => {
				void appendPrdTrace(requestId, 'auto_worker_finished', {
					success: result.success,
					error: result.error || null,
					durationMs: result.durationMs || null,
					sessionId: result.openclawSessionId
				});
			})
			.catch((error: unknown) => {
				void appendPrdTrace(requestId, 'auto_worker_error', {
					error: error instanceof Error ? error.message : String(error)
				});
			});

		return true;
	} catch (error) {
		await appendPrdTrace(requestId, 'auto_start_failed', {
			provider: 'codex',
			error: error instanceof Error ? error.message : String(error)
		});
		return false;
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

		const { content, requestId, projectName, options, chatId, userId, buildMode, buildModeReason, telegramRelay } =
			await event.request.json();
		const normalizedBuildMode = normalizeBuildMode(buildMode);
		const normalizedTelegramRelay = normalizeTelegramRelay(telegramRelay);
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

		// Write the PRD content to file
		await writeFile(paths.pendingPrdFile, content, 'utf-8');

		// Write request metadata
		const requestMeta = {
			requestId,
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

		const codexStarted = await startCodexAutoAnalysis(
			requestId,
			requestMeta.projectName,
			requestMeta.buildMode
		);
		if (codexStarted) {
			scheduleAutoAnalysisWatchdog(requestId);
		}

		console.log(`[PRDBridge] PRD written to ${paths.pendingPrdFile}`);
		console.log(`[PRDBridge] Request ID: ${requestId}`);
		console.log(`[PRDBridge] Codex auto-analysis: ${codexStarted ? 'started' : 'not-started'}`);

		return json({
			success: true,
			path: paths.pendingPrdFile,
			requestId,
			autoAnalysis: {
				provider: 'codex',
				started: codexStarted
			}
		});
	} catch (error) {
		console.error('[PRDBridge] Error writing PRD:', error);
		return json({ error: 'Failed to write PRD file' }, { status: 500 });
	}
};
