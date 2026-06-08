/**
 * PRD Bridge - Pending Endpoint
 *
 * Returns any pending PRD analysis requests.
 * Claude Code can poll this endpoint or check the file directly.
 *
 * GET /api/prd-bridge/pending - Get pending request info
 * DELETE /api/prd-bridge/pending - Clear the pending request after processing
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { reconcilePendingPrdCanonicalResult } from '$lib/server/prd-canonical-result-reconciliation';
import { spawnerStateDir } from '$lib/server/spawner-state';
import { requireControlAuth } from '$lib/server/mcp-auth';

function getPrdBridgePaths() {
	const spawnerDir = spawnerStateDir();
	return {
		pendingPrdFile: join(spawnerDir, 'pending-prd.md'),
		pendingRequestFile: join(spawnerDir, 'pending-request.json')
	};
}

/**
 * GET - Check if there's a pending PRD analysis request
 */
export const GET: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'PRDBridgePending',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: true,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	try {
		const { pendingPrdFile, pendingRequestFile } = getPrdBridgePaths();

		if (!existsSync(pendingRequestFile)) {
			return json({ pending: false });
		}

		const requestMeta = JSON.parse(await readFile(pendingRequestFile, 'utf-8'));
		const requestId = typeof requestMeta.requestId === 'string' ? requestMeta.requestId : undefined;
		const canonicalResult = await reconcilePendingPrdCanonicalResult({
			requestId,
			source: 'prd_bridge_pending_get'
		});
		if (canonicalResult.reconciled || canonicalResult.reason === 'already_complete') {
			return json({ pending: false });
		}

		// Only return if status is pending
		if (requestMeta.status !== 'pending') {
			return json({ pending: false });
		}

		// Read the PRD content
		let prdContent = '';
		if (existsSync(pendingPrdFile)) {
			prdContent = await readFile(pendingPrdFile, 'utf-8');
		}

		return json({
			pending: true,
			requestId: requestMeta.requestId,
			missionId: requestMeta.missionId,
			projectName: requestMeta.projectName,
			timestamp: requestMeta.timestamp,
			prdContent,
			options: requestMeta.options || { includeSkills: true, includeMCPs: true },
			relay: requestMeta.relay || null,
			buildMode: requestMeta.buildMode || null,
			buildModeReason: requestMeta.buildModeReason || null
		});
	} catch (error) {
		console.error('[PRDBridge] Error reading pending request:', error);
		return json({ pending: false, error: 'Failed to read pending request' });
	}
};

/**
 * DELETE - Clear the pending request (mark as processed)
 */
export const DELETE: RequestHandler = async (event) => {
	const unauthorized = requireControlAuth(event, {
		surface: 'PRDBridgePending',
		apiKeyEnvVar: 'EVENTS_API_KEY',
		fallbackApiKeyEnvVar: 'MCP_API_KEY',
		apiKeyQueryParam: 'apiKey',
		apiKeyCookieName: 'spawner_events_api_key',
		allowLoopbackWithoutKey: false,
		allowedOriginsEnvVar: 'EVENTS_ALLOWED_ORIGINS'
	});
	if (unauthorized) return unauthorized;

	try {
		const { pendingRequestFile } = getPrdBridgePaths();

		if (existsSync(pendingRequestFile)) {
			const requestMeta = JSON.parse(await readFile(pendingRequestFile, 'utf-8'));
			requestMeta.status = 'processed';
			requestMeta.processedAt = new Date().toISOString();
			await writeFile(pendingRequestFile, JSON.stringify(requestMeta, null, 2), 'utf-8');
		}

		return json({ success: true });
	} catch (error) {
		console.error('[PRDBridge] Error clearing pending request:', error);
		return json({ error: 'Failed to clear pending request' }, { status: 500 });
	}
};
