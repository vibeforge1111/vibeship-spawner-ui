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

const SPAWNER_DIR = join(process.cwd(), '.spawner');
const PENDING_LOAD_FILE = join(SPAWNER_DIR, 'pending-load.json');

// Ensure .spawner directory exists
async function ensureDir(): Promise<void> {
	if (!existsSync(SPAWNER_DIR)) {
		await mkdir(SPAWNER_DIR, { recursive: true });
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
			timestamp: payload.timestamp || new Date().toISOString()
		};

		await writeFile(PENDING_LOAD_FILE, JSON.stringify(load, null, 2), 'utf-8');

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

		if (!existsSync(PENDING_LOAD_FILE)) {
			return json({ pending: false });
		}

		const content = await readFile(PENDING_LOAD_FILE, 'utf-8');
		const load = JSON.parse(content);

		// If not peeking, delete the file (consume the load)
		if (!peek) {
			await unlink(PENDING_LOAD_FILE);
			console.log(`[PipelineLoader] Consumed: ${load.pipelineName}`);
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
		if (existsSync(PENDING_LOAD_FILE)) {
			await unlink(PENDING_LOAD_FILE);
			console.log('[PipelineLoader] Cleared pending load');
		}
		return json({ success: true });
	} catch (error) {
		console.error('[PipelineLoader] DELETE error:', error);
		return json({ error: 'Failed to clear pending load' }, { status: 500 });
	}
};
