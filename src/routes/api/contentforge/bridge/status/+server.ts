/**
 * ContentForge Bridge - Status Endpoint
 *
 * GET /api/contentforge/bridge/status
 * Returns the status of the Claude Code bridge connection and current activity.
 *
 * PATCH /api/contentforge/bridge/status
 * Updates worker progress during analysis (real-time status updates).
 *
 * POST /api/contentforge/bridge/status
 * Called by Claude Code to indicate it's connected/active.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SPAWNER_DIR = '.spawner';
const STATUS_FILE = 'claude-code-status.json';
const CONNECTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes (was 5 min, too aggressive)
const BUSY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes max for a task

export interface WorkerStatus {
	connected: boolean;
	lastSeen: string;
	version: string;
	busy: boolean;
	currentTask?: string;
	progress?: string[];
	startedAt?: string;
	requestId?: string;
}

async function getStatusData(): Promise<WorkerStatus | null> {
	const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
	const statusPath = path.join(spawnerPath, STATUS_FILE);

	if (existsSync(statusPath)) {
		try {
			return JSON.parse(await readFile(statusPath, 'utf-8'));
		} catch {
			return null;
		}
	}
	return null;
}

async function saveStatusData(data: WorkerStatus): Promise<void> {
	const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
	const statusPath = path.join(spawnerPath, STATUS_FILE);

	if (!existsSync(spawnerPath)) {
		await mkdir(spawnerPath, { recursive: true });
	}
	await writeFile(statusPath, JSON.stringify(data, null, 2), 'utf-8');
}

export const GET: RequestHandler = async () => {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const statusPath = path.join(spawnerPath, STATUS_FILE);

		// Check if status file exists and is recent
		if (existsSync(statusPath)) {
			const stats = await stat(statusPath);
			const ageMs = Date.now() - stats.mtimeMs;

			if (ageMs < CONNECTION_TIMEOUT_MS) {
				const statusData = await getStatusData();
				if (statusData) {
					// Check if busy status is stale (task running too long)
					if (statusData.busy && statusData.startedAt) {
						const taskAgeMs = Date.now() - new Date(statusData.startedAt).getTime();
						if (taskAgeMs > BUSY_TIMEOUT_MS) {
							// Task timed out, mark as not busy
							statusData.busy = false;
							statusData.currentTask = undefined;
							statusData.progress = undefined;
							statusData.startedAt = undefined;
							await saveStatusData(statusData);
						}
					}

					return json({
						connected: true,
						lastSeen: statusData.lastSeen || stats.mtime.toISOString(),
						version: statusData.version || 'unknown',
						busy: statusData.busy || false,
						currentTask: statusData.currentTask,
						progress: statusData.progress || [],
						startedAt: statusData.startedAt,
						requestId: statusData.requestId
					});
				}
			}
		}

		return json({
			connected: false,
			busy: false,
			message: 'Claude Code connection not detected. Analysis will use local heuristics.',
			hint: 'Run ContentForge analysis while Claude Code is active for AI-powered insights.'
		});

	} catch (error) {
		console.error('[ContentForge Bridge] Status check error:', error);
		return json({
			connected: false,
			busy: false,
			error: error instanceof Error ? error.message : 'Status check failed'
		});
	}
};

/**
 * POST /api/contentforge/bridge/status
 * Called by Claude Code to indicate it's connected/active.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json().catch(() => ({}));

		const existingStatus = await getStatusData();

		const statusData: WorkerStatus = {
			connected: true,
			lastSeen: new Date().toISOString(),
			version: body.version || 'claude-code',
			busy: existingStatus?.busy || false,
			currentTask: existingStatus?.currentTask,
			progress: existingStatus?.progress,
			startedAt: existingStatus?.startedAt,
			requestId: existingStatus?.requestId
		};

		await saveStatusData(statusData);

		return json({ success: true, ...statusData });

	} catch (error) {
		console.error('[ContentForge Bridge] Status update error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Status update failed' },
			{ status: 500 }
		);
	}
};

/**
 * PATCH /api/contentforge/bridge/status
 * Called by Claude Code to update progress during analysis.
 *
 * Body options:
 * - { action: "start", requestId: "...", task: "Loading H70 skills..." }
 * - { action: "progress", step: "Marketing Agent complete" }
 * - { action: "complete" }
 * - { action: "error", error: "..." }
 */
export const PATCH: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { action, requestId, task, step, error: errorMsg } = body;

		const existingStatus = await getStatusData() || {
			connected: true,
			lastSeen: new Date().toISOString(),
			version: 'claude-code',
			busy: false,
			progress: []
		};

		existingStatus.lastSeen = new Date().toISOString();

		switch (action) {
			case 'start':
				existingStatus.busy = true;
				existingStatus.currentTask = task || 'Starting analysis...';
				existingStatus.progress = [];
				existingStatus.startedAt = new Date().toISOString();
				existingStatus.requestId = requestId;
				break;

			case 'progress':
				if (step) {
					existingStatus.progress = existingStatus.progress || [];
					existingStatus.progress.push(step);
					existingStatus.currentTask = step;
				}
				break;

			case 'complete':
				existingStatus.busy = false;
				existingStatus.currentTask = undefined;
				existingStatus.progress = undefined;
				existingStatus.startedAt = undefined;
				existingStatus.requestId = undefined;
				break;

			case 'error':
				existingStatus.busy = false;
				existingStatus.currentTask = `Error: ${errorMsg || 'Unknown error'}`;
				// Keep progress for debugging
				break;

			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}

		await saveStatusData(existingStatus);

		return json({ success: true, ...existingStatus });

	} catch (error) {
		console.error('[ContentForge Bridge] Progress update error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Progress update failed' },
			{ status: 500 }
		);
	}
};
