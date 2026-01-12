/**
 * API endpoint to clean up pending ContentForge files
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SPAWNER_DIR = '.spawner';
const PENDING_FILES = [
	'pending-contentforge.md',
	'pending-contentforge-request.json'
];

export const POST: RequestHandler = async () => {
	const cleaned: string[] = [];
	const errors: string[] = [];

	for (const filename of PENDING_FILES) {
		const filepath = path.join(SPAWNER_DIR, filename);
		if (existsSync(filepath)) {
			try {
				await unlink(filepath);
				cleaned.push(filename);
				console.log('[Cleanup] Removed:', filename);
			} catch (e) {
				errors.push(`${filename}: ${e instanceof Error ? e.message : 'Unknown error'}`);
			}
		}
	}

	return json({
		success: errors.length === 0,
		cleaned,
		errors: errors.length > 0 ? errors : undefined
	});
};
