/**
 * ContentForge Bridge - Pending Endpoint
 *
 * GET /api/contentforge/bridge/pending
 * Returns pending content analysis request for Claude Code to process.
 * Will NOT return work if the worker is currently busy (prevents overlapping tasks).
 *
 * This is how Claude Code discovers that content needs analysis.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SPAWNER_DIR = '.spawner';
const CONTENT_FILE = 'pending-contentforge.md';
const REQUEST_FILE = 'pending-contentforge-request.json';
const STATUS_FILE = 'claude-code-status.json';
const BUSY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes max for a task

async function isWorkerBusy(): Promise<boolean> {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const statusPath = path.join(spawnerPath, STATUS_FILE);

		if (!existsSync(statusPath)) {
			return false;
		}

		const statusData = JSON.parse(await readFile(statusPath, 'utf-8'));

		// Check if marked as busy
		if (!statusData.busy) {
			return false;
		}

		// Check if task has timed out
		if (statusData.startedAt) {
			const taskAgeMs = Date.now() - new Date(statusData.startedAt).getTime();
			if (taskAgeMs > BUSY_TIMEOUT_MS) {
				return false; // Task timed out, not really busy
			}
		}

		return true;
	} catch {
		return false;
	}
}

export const GET: RequestHandler = async () => {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const contentPath = path.join(spawnerPath, CONTENT_FILE);
		const requestPath = path.join(spawnerPath, REQUEST_FILE);

		// Check if there's a pending request
		if (!existsSync(requestPath) || !existsSync(contentPath)) {
			return json({ pending: false });
		}

		// Check if worker is busy - don't give new work until current task is done
		if (await isWorkerBusy()) {
			return json({
				pending: false,
				busy: true,
				message: 'Worker is busy with current task. Complete it first.'
			});
		}

		// Read request metadata
		const requestData = JSON.parse(await readFile(requestPath, 'utf-8'));

		// Read content (now includes bundled H70 skills)
		const content = await readFile(contentPath, 'utf-8');

		return json({
			pending: true,
			requestId: requestData.requestId,
			timestamp: requestData.timestamp,
			skillsLoaded: requestData.skillsLoaded || [],
			skillsBundled: true, // Skills are embedded in the content
			content
		});

	} catch (error) {
		console.error('[ContentForge Bridge] Pending check error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to check pending' },
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/contentforge/bridge/pending
 * Clears the pending request after processing.
 */
export const DELETE: RequestHandler = async () => {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const contentPath = path.join(spawnerPath, CONTENT_FILE);
		const requestPath = path.join(spawnerPath, REQUEST_FILE);

		// Remove files if they exist
		if (existsSync(contentPath)) {
			await unlink(contentPath);
		}
		if (existsSync(requestPath)) {
			await unlink(requestPath);
		}

		return json({ success: true, message: 'Pending request cleared' });

	} catch (error) {
		console.error('[ContentForge Bridge] Clear error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to clear pending' },
			{ status: 500 }
		);
	}
};
