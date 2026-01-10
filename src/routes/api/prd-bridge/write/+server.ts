/**
 * PRD Bridge - Write Endpoint
 *
 * Writes PRD content to a file for Claude Code to analyze.
 * Called by Spawner UI when user uploads a PRD.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Store pending PRDs in the project's .spawner directory
const SPAWNER_DIR = join(process.cwd(), '.spawner');
const PENDING_PRD_FILE = join(SPAWNER_DIR, 'pending-prd.md');
const PENDING_REQUEST_FILE = join(SPAWNER_DIR, 'pending-request.json');

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

		console.log(`[PRDBridge] PRD written to ${PENDING_PRD_FILE}`);
		console.log(`[PRDBridge] Request ID: ${requestId}`);

		return json({
			success: true,
			path: PENDING_PRD_FILE,
			requestId
		});
	} catch (error) {
		console.error('[PRDBridge] Error writing PRD:', error);
		return json({ error: 'Failed to write PRD file' }, { status: 500 });
	}
};
