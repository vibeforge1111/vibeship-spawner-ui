/**
 * ContentForge Bridge - Status Endpoint
 *
 * GET /api/contentforge/bridge/status
 * Returns the status of the Claude Code bridge connection.
 *
 * The bridge is considered "connected" if:
 * 1. Recent activity has been detected (within last 5 minutes)
 * 2. Or the ping file exists
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SPAWNER_DIR = '.spawner';
const STATUS_FILE = 'claude-code-status.json';
const CONNECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const GET: RequestHandler = async () => {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const statusPath = path.join(spawnerPath, STATUS_FILE);

		// Check if status file exists and is recent
		if (existsSync(statusPath)) {
			const stats = await stat(statusPath);
			const ageMs = Date.now() - stats.mtimeMs;

			if (ageMs < CONNECTION_TIMEOUT_MS) {
				const statusData = JSON.parse(await readFile(statusPath, 'utf-8'));
				return json({
					connected: true,
					lastSeen: statusData.lastSeen || stats.mtime.toISOString(),
					version: statusData.version || 'unknown'
				});
			}
		}

		// No recent activity - but let's be optimistic
		// If the user is running Claude Code right now, it will process requests
		return json({
			connected: false,
			message: 'Claude Code connection not detected. Analysis will use local heuristics.',
			hint: 'Run ContentForge analysis while Claude Code is active for AI-powered insights.'
		});

	} catch (error) {
		console.error('[ContentForge Bridge] Status check error:', error);
		return json({
			connected: false,
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

		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const statusPath = path.join(spawnerPath, STATUS_FILE);

		const { writeFile, mkdir } = await import('node:fs/promises');

		if (!existsSync(spawnerPath)) {
			await mkdir(spawnerPath, { recursive: true });
		}

		const statusData = {
			connected: true,
			lastSeen: new Date().toISOString(),
			version: body.version || 'claude-code',
			capabilities: body.capabilities || ['contentforge-analysis']
		};

		await writeFile(statusPath, JSON.stringify(statusData, null, 2), 'utf-8');

		return json({ success: true, ...statusData });

	} catch (error) {
		console.error('[ContentForge Bridge] Status update error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Status update failed' },
			{ status: 500 }
		);
	}
};
