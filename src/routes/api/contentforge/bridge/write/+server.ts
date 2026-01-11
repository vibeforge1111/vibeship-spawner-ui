/**
 * ContentForge Bridge - Write Endpoint
 *
 * POST /api/contentforge/bridge/write
 * Writes content to a file for Claude Code to analyze.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SPAWNER_DIR = '.spawner';
const CONTENT_FILE = 'pending-contentforge.md';
const REQUEST_FILE = 'pending-contentforge-request.json';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, requestId } = await request.json();

		if (!content || !requestId) {
			return json({ error: 'content and requestId are required' }, { status: 400 });
		}

		// Ensure .spawner directory exists
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		if (!existsSync(spawnerPath)) {
			await mkdir(spawnerPath, { recursive: true });
		}

		// Write content file
		const contentPath = path.join(spawnerPath, CONTENT_FILE);
		await writeFile(contentPath, content, 'utf-8');

		// Write request metadata
		const requestPath = path.join(spawnerPath, REQUEST_FILE);
		const requestData = {
			requestId,
			timestamp: new Date().toISOString(),
			contentPath,
			status: 'pending'
		};
		await writeFile(requestPath, JSON.stringify(requestData, null, 2), 'utf-8');

		console.log(`[ContentForge Bridge] Written content for analysis: ${requestId}`);

		return json({
			success: true,
			path: contentPath,
			requestId
		});

	} catch (error) {
		console.error('[ContentForge Bridge] Write error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to write content' },
			{ status: 500 }
		);
	}
};
