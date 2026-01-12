/**
 * API endpoint for rewrite results
 *
 * GET: Poll for result status
 * POST: Submit result from Claude Code
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SPAWNER_DIR = '.spawner';
const RESULT_FILE = path.join(SPAWNER_DIR, 'rewrite-result.json');
const PENDING_FILE = path.join(SPAWNER_DIR, 'pending-rewrite.json');

// In-memory cache for results (cleared on server restart)
const resultCache = new Map<string, {
	status: 'pending' | 'complete' | 'error';
	rewrites?: Array<{
		version: string;
		content: string;
		estimatedScore: number;
		changes: string[];
	}>;
	error?: string;
	timestamp: string;
}>();

/**
 * GET: Poll for rewrite result
 */
export const GET: RequestHandler = async ({ url }) => {
	const requestId = url.searchParams.get('requestId');

	if (!requestId) {
		return json({ error: 'Missing requestId' }, { status: 400 });
	}

	// Check in-memory cache first
	const cached = resultCache.get(requestId);
	if (cached) {
		return json(cached);
	}

	// Check file-based result
	if (existsSync(RESULT_FILE)) {
		try {
			const content = await readFile(RESULT_FILE, 'utf-8');
			const result = JSON.parse(content);

			if (result.requestId === requestId) {
				// Cache it
				resultCache.set(requestId, result);
				// Clean up file
				await unlink(RESULT_FILE).catch(() => {});
				return json(result);
			}
		} catch (e) {
			console.warn('[RewriteResult] Error reading result file:', e);
		}
	}

	// Check if request is still pending
	if (existsSync(PENDING_FILE)) {
		try {
			const content = await readFile(PENDING_FILE, 'utf-8');
			const pending = JSON.parse(content);

			if (pending.requestId === requestId) {
				return json({
					status: 'pending',
					requestId,
					message: 'Waiting for Claude Code to process'
				});
			}
		} catch (e) {
			// Ignore read errors
		}
	}

	// Not found
	return json({
		status: 'error',
		error: 'Request not found or expired'
	});
};

/**
 * POST: Submit result from Claude Code
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { requestId, status, rewrites, error } = data;

		if (!requestId) {
			return json({ error: 'Missing requestId' }, { status: 400 });
		}

		const result = {
			requestId,
			status: status || 'complete',
			rewrites: rewrites || [],
			error,
			timestamp: new Date().toISOString()
		};

		// Store in cache
		resultCache.set(requestId, result);

		// Also write to file for persistence
		await writeFile(RESULT_FILE, JSON.stringify(result, null, 2), 'utf-8');

		// Clean up pending request
		if (existsSync(PENDING_FILE)) {
			await unlink(PENDING_FILE).catch(() => {});
		}
		const pendingMd = path.join(SPAWNER_DIR, 'pending-rewrite.md');
		if (existsSync(pendingMd)) {
			await unlink(pendingMd).catch(() => {});
		}

		console.log('[RewriteResult] Result submitted:', requestId, 'rewrites:', rewrites?.length || 0);

		return json({
			success: true,
			message: 'Result stored successfully'
		});

	} catch (e) {
		console.error('[RewriteResult] Error:', e);
		return json({
			error: e instanceof Error ? e.message : 'Unknown error'
		}, { status: 500 });
	}
};

/**
 * DELETE: Clear a result (cleanup)
 */
export const DELETE: RequestHandler = async ({ url }) => {
	const requestId = url.searchParams.get('requestId');

	if (requestId) {
		resultCache.delete(requestId);
	}

	return json({ success: true });
};
