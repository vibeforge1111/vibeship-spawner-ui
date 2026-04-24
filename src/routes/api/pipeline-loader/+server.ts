/**
 * Pipeline Loader API
 *
 * Single endpoint for the file-based pipeline loading queue.
 * This eliminates race conditions by persisting load requests to disk.
 *
 * POST - Queue a pipeline to load
 * GET  - Get (and consume) the pending load
 * DELETE - Clear the pending load
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

function getSpawnerDir(): string {
	return process.env.SPAWNER_STATE_DIR || join(process.cwd(), '.spawner');
}

function getPendingLoadFile(): string {
	return join(getSpawnerDir(), 'pending-load.json');
}

function getLastLoadFile(): string {
	return join(getSpawnerDir(), 'last-canvas-load.json');
}

// Ensure .spawner directory exists
async function ensureDir(): Promise<void> {
	const spawnerDir = getSpawnerDir();
	if (!existsSync(spawnerDir)) {
		await mkdir(spawnerDir, { recursive: true });
	}
}

/**
 * POST - Queue a pipeline to load
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		await ensureDir();
		const payload = await request.json();

		// Validate required fields
		if (!payload.pipelineId || !payload.pipelineName) {
			return json({ error: 'pipelineId and pipelineName are required' }, { status: 400 });
		}

		// Ensure nodes and connections are arrays
		const load = {
			pipelineId: payload.pipelineId,
			pipelineName: payload.pipelineName,
			nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
			connections: Array.isArray(payload.connections) ? payload.connections : [],
			source: payload.source || 'new',
			buildMode: payload.buildMode,
			buildModeReason: payload.buildModeReason,
			executionPrompt: payload.executionPrompt,
			autoRun: payload.autoRun === true,
			relay: payload.relay,
			timestamp: payload.timestamp || new Date().toISOString()
		};

		await writeFile(getPendingLoadFile(), JSON.stringify(load, null, 2), 'utf-8');
		await writeFile(getLastLoadFile(), JSON.stringify(load, null, 2), 'utf-8');

		console.log(`[PipelineLoader] Queued: ${load.pipelineName} (${load.nodes.length} nodes, ${load.connections.length} connections)`);

		return json({ success: true, queued: load.pipelineName });
	} catch (error) {
		console.error('[PipelineLoader] POST error:', error);
		return json({ error: 'Failed to queue pipeline load' }, { status: 500 });
	}
};

/**
 * GET - Get the pending load (optionally peek without consuming)
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const peek = url.searchParams.get('peek') === 'true';
		const latest = url.searchParams.get('latest') === 'true';
		const loadFile = latest ? getLastLoadFile() : getPendingLoadFile();

		if (!existsSync(loadFile)) {
			return json({ pending: false });
		}

		const content = await readFile(loadFile, 'utf-8');
		const load = JSON.parse(content);

		// If not peeking, delete the file (consume the load). Multiple canvas
		// tabs can race here; the read load is still valid even when another
		// client deletes the queue file first or Windows briefly denies unlink.
		if (!peek && !latest) {
			try {
				await unlink(loadFile);
				console.log(`[PipelineLoader] Consumed: ${load.pipelineName}`);
			} catch (unlinkError) {
				const code = unlinkError && typeof unlinkError === 'object' && 'code' in unlinkError
					? String((unlinkError as { code?: unknown }).code)
					: 'unknown';
				if (code === 'ENOENT' || code === 'EPERM') {
					console.warn(`[PipelineLoader] Queue already consumed or locked after read (${code}); returning load anyway.`);
				} else {
					throw unlinkError;
				}
			}
		}

		return json({ pending: true, load });
	} catch (error) {
		console.error('[PipelineLoader] GET error:', error);
		return json({ pending: false });
	}
};

/**
 * DELETE - Clear the pending load
 */
export const DELETE: RequestHandler = async () => {
	try {
		const pendingLoadFile = getPendingLoadFile();
		if (existsSync(pendingLoadFile)) {
			await unlink(pendingLoadFile);
			console.log('[PipelineLoader] Cleared pending load');
		}
		return json({ success: true });
	} catch (error) {
		console.error('[PipelineLoader] DELETE error:', error);
		return json({ error: 'Failed to clear pending load' }, { status: 500 });
	}
};
