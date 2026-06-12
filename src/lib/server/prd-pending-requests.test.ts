import { mkdir, stat, writeFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => {
	const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
	const tempRoot = process.env.TMPDIR || process.env.TEMP || process.env.TMP || process.cwd();
	const spawnerDir = `${tempRoot}/spawner-pending-requests-${process.pid}-${Date.now()}`;
	process.env.SPAWNER_STATE_DIR = spawnerDir;
	return { originalSpawnerStateDir, spawnerDir };
});

import { readMissionControlStateTransitionsForTests } from './mission-control-relay';
import {
	pendingPrdFileForRequest,
	pendingRequestFileForRequest,
	pendingRequestsDir,
	pruneStalePendingRequests
} from './prd-pending-requests';

describe('prd-pending-requests', () => {
	afterAll(() => {
		if (testState.originalSpawnerStateDir === undefined) {
			delete process.env.SPAWNER_STATE_DIR;
		} else {
			process.env.SPAWNER_STATE_DIR = testState.originalSpawnerStateDir;
		}
		rmSync(testState.spawnerDir, { recursive: true, force: true });
	});

	it('prunes stale request-scoped pending files with uniform transition events', async () => {
		const requestId = 'req-pending-timeout';
		await mkdir(pendingRequestsDir(testState.spawnerDir), { recursive: true });
		const requestFile = pendingRequestFileForRequest(testState.spawnerDir, requestId);
		const prdFile = pendingPrdFileForRequest(testState.spawnerDir, requestId);
		await writeFile(requestFile, JSON.stringify({ requestId, traceRef: 'trace-pending-timeout' }), 'utf-8');
		await writeFile(prdFile, 'stale prd', 'utf-8');

		const pruned = await pruneStalePendingRequests(testState.spawnerDir, new Date(Date.now() + 1000));

		await expect(stat(requestFile)).rejects.toThrow();
		await expect(stat(prdFile)).rejects.toThrow();
		expect(pruned).toBe(1);
		expect(readMissionControlStateTransitionsForTests()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entity_type: 'spawner.pending_request',
					entity_id: requestId,
					from_state: 'active',
					to_state: 'expired',
					reason: 'pending_request_timeout',
					request_id: requestId
				})
			])
		);
	});
});
