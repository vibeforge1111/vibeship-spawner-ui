/**
 * RequestId-scoped pending PRD request storage.
 *
 * /api/prd-bridge/write historically stored the pending PRD and request
 * metadata in singleton files (pending-prd.md, pending-request.json), so two
 * concurrent requests cross-contaminated each other. Writes now land in
 * requestId-scoped files under pending-requests/, while the singleton files
 * are kept as a back-compat pointer to the most recent request.
 *
 * Readers that need to bind machine-origin callbacks (provider results and
 * events) to a governed request use readPendingRequestRecord: scoped file
 * first, singleton pointer fallback, always verified against the requestId.
 */

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseJsonOrFallback } from '$lib/utils/safe-json';

export function normalizePendingRequestId(requestId: string): string {
	return requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function pendingRequestsDir(spawnerDir: string): string {
	return join(spawnerDir, 'pending-requests');
}

export function pendingRequestFileForRequest(spawnerDir: string, requestId: string): string {
	return join(pendingRequestsDir(spawnerDir), `${normalizePendingRequestId(requestId)}.json`);
}

export function pendingPrdFileForRequest(spawnerDir: string, requestId: string): string {
	return join(pendingRequestsDir(spawnerDir), `${normalizePendingRequestId(requestId)}.md`);
}

/**
 * Read the pending request record bound to requestId, or null when no
 * governed pending request matches. Prefers requestId-scoped storage and
 * falls back to the singleton pointer (pending-request.json) when it matches.
 */
export async function readPendingRequestRecord(
	spawnerDir: string,
	requestId: string
): Promise<Record<string, unknown> | null> {
	const scopedFile = pendingRequestFileForRequest(spawnerDir, requestId);
	if (existsSync(scopedFile)) {
		try {
			const parsed = parseJsonOrFallback<Record<string, unknown>>(
				await readFile(scopedFile, 'utf-8'),
				{},
				`pending-request-scoped:${requestId}`
			);
			if (parsed.requestId === requestId) return parsed;
		} catch {
			// Fall through to the singleton pointer.
		}
	}

	const singletonFile = join(spawnerDir, 'pending-request.json');
	if (!existsSync(singletonFile)) return null;
	try {
		const parsed = parseJsonOrFallback<Record<string, unknown>>(
			await readFile(singletonFile, 'utf-8'),
			{},
			'pending-request-singleton'
		);
		return parsed.requestId === requestId ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Read the pending PRD content bound to requestId. Prefers the
 * requestId-scoped PRD file; falls back to the singleton pending-prd.md only
 * when the singleton pending-request pointer matches the requestId.
 */
export async function readPendingPrdContent(
	spawnerDir: string,
	requestId: string
): Promise<string | null> {
	const scopedFile = pendingPrdFileForRequest(spawnerDir, requestId);
	if (existsSync(scopedFile)) {
		try {
			return await readFile(scopedFile, 'utf-8');
		} catch {
			// Fall through to the singleton pointer.
		}
	}

	const singletonPrd = join(spawnerDir, 'pending-prd.md');
	if (!existsSync(singletonPrd)) return null;
	const record = await readPendingRequestRecord(spawnerDir, requestId);
	if (!record) return null;
	try {
		return await readFile(singletonPrd, 'utf-8');
	} catch {
		return null;
	}
}
