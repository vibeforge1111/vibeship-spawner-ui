/**
 * PRD Bridge - Result Endpoint
 *
 * Stores and retrieves PRD analysis results.
 * This is a file-based fallback when SSE doesn't work.
 *
 * POST /api/prd-bridge/result - Store analysis result (called by event handler)
 * GET /api/prd-bridge/result?requestId=xxx - Get result for a specific request
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const SPAWNER_DIR = join(process.cwd(), '.spawner');
const RESULTS_DIR = join(SPAWNER_DIR, 'results');

/**
 * POST - Store an analysis result
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { requestId, result } = await request.json();

		if (!requestId || !result) {
			return json({ error: 'requestId and result are required' }, { status: 400 });
		}

		// Ensure results directory exists
		if (!existsSync(RESULTS_DIR)) {
			await mkdir(RESULTS_DIR, { recursive: true });
		}

		// Write result to file
		const resultFile = join(RESULTS_DIR, `${requestId}.json`);
		await writeFile(resultFile, JSON.stringify(result, null, 2), 'utf-8');

		console.log('[PRDBridge] Stored result for:', requestId);
		return json({ success: true, requestId });
	} catch (error) {
		console.error('[PRDBridge] Error storing result:', error);
		return json({ error: 'Failed to store result' }, { status: 500 });
	}
};

/**
 * GET - Retrieve an analysis result by requestId
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const requestId = url.searchParams.get('requestId');

		if (!requestId) {
			return json({ error: 'requestId is required' }, { status: 400 });
		}

		const resultFile = join(RESULTS_DIR, `${requestId}.json`);

		if (!existsSync(resultFile)) {
			return json({ found: false, requestId });
		}

		const result = JSON.parse(await readFile(resultFile, 'utf-8'));
		return json({ found: true, requestId, result });
	} catch (error) {
		console.error('[PRDBridge] Error reading result:', error);
		return json({ error: 'Failed to read result' }, { status: 500 });
	}
};
