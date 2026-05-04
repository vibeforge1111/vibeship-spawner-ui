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
import { assertSafeId, PathSafetyError, resolveWithinBaseDir } from '$lib/server/path-safety';
import { validatePrdAnalysisResult } from '$lib/server/prd-analysis-result-schema';
import { spawnerStateDir } from '$lib/server/spawner-state';
import { logger } from '$lib/utils/logger';

const log = logger.scope('PRDBridge');

function getResultsDir(): string {
	const spawnerDir = spawnerStateDir();
	return join(spawnerDir, 'results');
}

/**
 * POST - Store an analysis result
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { requestId, result } = await request.json();

		if (!requestId || !result || typeof requestId !== 'string') {
			return json({ error: 'requestId and result are required' }, { status: 400 });
		}
		assertSafeId(requestId, 'requestId');
		const validatedResult = validatePrdAnalysisResult(requestId, result);

		// Ensure results directory exists
		const resultsDir = getResultsDir();

		if (!existsSync(resultsDir)) {
			await mkdir(resultsDir, { recursive: true });
		}

		// Write result to file
		const resultFile = resolveWithinBaseDir(resultsDir, `${requestId}.json`);
		await writeFile(resultFile, JSON.stringify(validatedResult, null, 2), 'utf-8');

		log.info(`Stored result for: ${requestId}`);
		return json({ success: true, requestId });
	} catch (error) {
		if (error instanceof PathSafetyError) {
			return json({ error: error.message }, { status: error.status });
		}
		if (error instanceof Error && error.message.startsWith('Invalid PRD analysis result:')) {
			return json({ error: error.message }, { status: 400 });
		}
		if (error instanceof Error && error.message.startsWith('Invalid PRD analysis result: requestId mismatch')) {
			return json({ error: error.message }, { status: 400 });
		}

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
		assertSafeId(requestId, 'requestId');

		const resultsDir = getResultsDir();
		const resultFile = resolveWithinBaseDir(resultsDir, `${requestId}.json`);

		if (!existsSync(resultFile)) {
			return json({ found: false, requestId });
		}

		const result = JSON.parse(await readFile(resultFile, 'utf-8'));
		return json({ found: true, requestId, result });
	} catch (error) {
		if (error instanceof PathSafetyError) {
			return json({ error: error.message }, { status: error.status });
		}

		console.error('[PRDBridge] Error reading result:', error);
		return json({ error: 'Failed to read result' }, { status: 500 });
	}
};
