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
import { execFileSync } from 'node:child_process';
import { openclawBridge } from '$lib/services/openclaw-bridge';

// Store pending PRDs in the project's .spawner directory
const SPAWNER_DIR = join(process.cwd(), '.spawner');
const RESULTS_DIR = join(SPAWNER_DIR, 'results');
const PENDING_PRD_FILE = join(SPAWNER_DIR, 'pending-prd.md');
const PENDING_REQUEST_FILE = join(SPAWNER_DIR, 'pending-request.json');
const PRD_AUTO_TRACE_FILE = join(SPAWNER_DIR, 'prd-auto-trace.jsonl');
const AUTO_ANALYSIS_ENDPOINT = 'http://127.0.0.1:5173/api/events';
const AUTO_ANALYSIS_TIMEOUT_MS = 55_000;

function normalizeRequestId(requestId: string): string {
	return requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function appendPrdTrace(requestId: string, event: string, details: Record<string, unknown> = {}): Promise<void> {
	try {
		const row = {
			ts: new Date().toISOString(),
			requestId,
			event,
			...details
		};
		await appendFile(PRD_AUTO_TRACE_FILE, `${JSON.stringify(row)}\n`, 'utf-8');
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
		if (!existsSync(PENDING_REQUEST_FILE)) return;
		const raw = await readFile(PENDING_REQUEST_FILE, 'utf-8');
		const current = JSON.parse(raw) as Record<string, unknown>;
		if (current.requestId !== requestId) return;

		const next = {
			...current,
			status,
			updatedAt: new Date().toISOString(),
			...extra
		};
		await writeFile(PENDING_REQUEST_FILE, JSON.stringify(next, null, 2), 'utf-8');
	} catch {
		// Keep analysis flow alive even if status updates fail.
	}
}

function scheduleAutoAnalysisWatchdog(requestId: string): void {
	const timer = setTimeout(async () => {
		const safeRequestId = normalizeRequestId(requestId);
		const resultFile = join(RESULTS_DIR, `${safeRequestId}.json`);
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
	const configured = process.env.CODEX_PATH?.trim();
	if (configured) return configured;

	try {
		const output = execFileSync('cmd.exe', ['/c', 'where', 'codex'], {
			encoding: 'utf-8',
			windowsHide: true,
			stdio: ['ignore', 'pipe', 'ignore']
		});
		const matches = output
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		if (matches.length === 0) return null;
		const cmdPath = matches.find((line) => line.toLowerCase().endsWith('.cmd'));
		return cmdPath || matches[0] || null;
	} catch {
		return null;
	}
}

function buildCodexPrompt(requestId: string, projectName: string): string {
	return [
		'You are running inside spawner-ui and must complete PRD analysis autonomously.',
		`Request ID: ${requestId}`,
		`Project Name Hint: ${projectName}`,
		'',
		'Execution steps (strict):',
		'1) Read .spawner/pending-request.json and confirm requestId matches.',
		'2) Read .spawner/pending-prd.md completely.',
		'3) Produce a valid PRD analysis result JSON with:',
		'   requestId, success, projectName, projectType, complexity, infrastructure, techStack, tasks, skills, executionPrompt.',
		'4) Include actionable tasks with skills, dependencies, and verification criteria.',
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

async function startCodexAutoAnalysis(requestId: string, projectName: string): Promise<boolean> {
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

		const prompt = buildCodexPrompt(requestId, projectName);
		const missionId = `prd-auto-${normalizeRequestId(requestId)}`;

		await appendPrdTrace(requestId, 'auto_worker_dispatch', {
			provider: 'codex',
			missionId,
			workingDirectory: process.cwd()
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

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, requestId, projectName, options } = await request.json();

		if (!content || !requestId) {
			return json({ error: 'Content and requestId are required' }, { status: 400 });
		}

		// Ensure .spawner directory exists
		if (!existsSync(SPAWNER_DIR)) {
			await mkdir(SPAWNER_DIR, { recursive: true });
		}
		if (!existsSync(RESULTS_DIR)) {
			await mkdir(RESULTS_DIR, { recursive: true });
		}

		// Write the PRD content to file
		await writeFile(PENDING_PRD_FILE, content, 'utf-8');

		// Write request metadata
		const requestMeta = {
			requestId,
			projectName: projectName || 'Untitled Project',
			timestamp: new Date().toISOString(),
			prdPath: PENDING_PRD_FILE,
			status: 'pending',
			options: {
				includeSkills: options?.includeSkills !== false,
				includeMCPs: options?.includeMCPs !== false
			}
		};
		await writeFile(PENDING_REQUEST_FILE, JSON.stringify(requestMeta, null, 2), 'utf-8');
		await appendPrdTrace(requestId, 'request_written', {
			projectName: requestMeta.projectName
		});

		const codexStarted = await startCodexAutoAnalysis(requestId, requestMeta.projectName);
		if (codexStarted) {
			scheduleAutoAnalysisWatchdog(requestId);
		}

		console.log(`[PRDBridge] PRD written to ${PENDING_PRD_FILE}`);
		console.log(`[PRDBridge] Request ID: ${requestId}`);
		console.log(`[PRDBridge] Codex auto-analysis: ${codexStarted ? 'started' : 'not-started'}`);

		return json({
			success: true,
			path: PENDING_PRD_FILE,
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
