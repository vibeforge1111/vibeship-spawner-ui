/**
 * PRD Bridge - Write Endpoint
 *
 * Writes PRD content to a file for runtime analysis.
 * Called by Spawner UI when user uploads a PRD.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { spawn, execFileSync } from 'node:child_process';

// Store pending PRDs in the project's .spawner directory
const SPAWNER_DIR = join(process.cwd(), '.spawner');
const PENDING_PRD_FILE = join(SPAWNER_DIR, 'pending-prd.md');
const PENDING_REQUEST_FILE = join(SPAWNER_DIR, 'pending-request.json');
const AUTO_ANALYSIS_ENDPOINT = 'http://127.0.0.1:5173/api/events';

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

function startCodexAutoAnalysis(requestId: string, projectName: string): boolean {
	const provider = (process.env.SPAWNER_PRD_AUTO_PROVIDER || 'codex').trim().toLowerCase();
	if (provider === 'none') {
		console.log('[PRDBridge] Auto-analysis disabled by SPAWNER_PRD_AUTO_PROVIDER=none');
		return false;
	}

	if (provider !== 'codex') {
		console.log(`[PRDBridge] Unsupported auto provider: ${provider}`);
		return false;
	}

	try {
		const codexBinary = resolveCodexBinary();
		if (!codexBinary) {
			console.warn('[PRDBridge] Codex binary not found; skipping auto-analysis');
			return false;
		}

		const prompt = buildCodexPrompt(requestId, projectName);
		const isCmdShim = codexBinary.toLowerCase().endsWith('.cmd');
		const spawnBinary = isCmdShim ? 'cmd.exe' : codexBinary;
		const spawnArgs = isCmdShim
			? ['/c', codexBinary, 'exec', '--yolo', prompt]
			: ['exec', '--yolo', prompt];

		const child = spawn(spawnBinary, spawnArgs, {
			cwd: process.cwd(),
			detached: true,
			stdio: 'ignore',
			windowsHide: true,
			env: { ...process.env }
		});

		child.once('error', (error) => {
			console.warn('[PRDBridge] Codex auto-analysis spawn error:', error);
		});

		child.unref();
		return true;
	} catch (error) {
		console.warn('[PRDBridge] Failed to start codex auto analysis:', error);
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, requestId, projectName } = await request.json();

		if (!content || !requestId) {
			return json({ error: 'Content and requestId are required' }, { status: 400 });
		}

		// Ensure .spawner directory exists
		if (!existsSync(SPAWNER_DIR)) {
			await mkdir(SPAWNER_DIR, { recursive: true });
		}

		// Write the PRD content to file
		await writeFile(PENDING_PRD_FILE, content, 'utf-8');

		// Write the request metadata
		const requestMeta = {
			requestId,
			projectName: projectName || 'Untitled Project',
			timestamp: new Date().toISOString(),
			prdPath: PENDING_PRD_FILE,
			status: 'pending'
		};
		await writeFile(PENDING_REQUEST_FILE, JSON.stringify(requestMeta, null, 2), 'utf-8');

		const codexStarted = startCodexAutoAnalysis(requestId, requestMeta.projectName);

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
