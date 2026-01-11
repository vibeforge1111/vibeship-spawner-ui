/**
 * ContentForge Bridge - Result Storage Endpoint
 *
 * POST /api/contentforge/bridge/result - Store analysis result (called by worker)
 * GET /api/contentforge/bridge/result - Retrieve latest result (polled by UI as fallback)
 * DELETE /api/contentforge/bridge/result - Clear result after retrieval
 *
 * This provides a fallback for when SSE doesn't deliver the result.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SPAWNER_DIR = '.spawner';
const RESULT_FILE = 'contentforge-result.json';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const result = await request.json();

		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const resultPath = path.join(spawnerPath, RESULT_FILE);

		if (!existsSync(spawnerPath)) {
			await mkdir(spawnerPath, { recursive: true });
		}

		await writeFile(resultPath, JSON.stringify({
			...result,
			storedAt: new Date().toISOString()
		}, null, 2), 'utf-8');

		console.log('[ContentForge] Result stored for requestId:', result.data?.requestId);

		return json({ success: true });
	} catch (error) {
		console.error('[ContentForge Bridge] Result store error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to store result' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async () => {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const resultPath = path.join(spawnerPath, RESULT_FILE);

		if (!existsSync(resultPath)) {
			return json({ hasResult: false });
		}

		const resultData = JSON.parse(await readFile(resultPath, 'utf-8'));

		return json({
			hasResult: true,
			...resultData
		});
	} catch (error) {
		console.error('[ContentForge Bridge] Result read error:', error);
		return json({ hasResult: false });
	}
};

export const DELETE: RequestHandler = async () => {
	try {
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		const resultPath = path.join(spawnerPath, RESULT_FILE);

		if (existsSync(resultPath)) {
			await unlink(resultPath);
		}

		return json({ success: true });
	} catch (error) {
		console.error('[ContentForge Bridge] Result delete error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to delete result' },
			{ status: 500 }
		);
	}
};
