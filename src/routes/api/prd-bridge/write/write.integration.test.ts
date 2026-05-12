import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { POST } from './+server';

const { PRIVATE_ENV } = vi.hoisted(() => ({
	PRIVATE_ENV: {
		SPARK_BRIDGE_API_KEY: 'bridge-test-key',
		MCP_API_KEY: ''
	} as Record<string, string>
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

let testSpawnerDir: string;
const originalProvider = process.env.SPARK_MISSION_LLM_PROVIDER;
const originalStateDir = process.env.SPAWNER_STATE_DIR;
const BRIDGE_TEST_KEY = 'bridge-test-key';
const originalBridgeKey = process.env.SPARK_BRIDGE_API_KEY;

async function resetTestSpawnerDir() {
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	if (originalStateDir === undefined) delete process.env.SPAWNER_STATE_DIR;
	else process.env.SPAWNER_STATE_DIR = originalStateDir;
	if (originalProvider === undefined) delete process.env.SPARK_MISSION_LLM_PROVIDER;
	else process.env.SPARK_MISSION_LLM_PROVIDER = originalProvider;
	if (originalBridgeKey === undefined) delete process.env.SPARK_BRIDGE_API_KEY;
	else process.env.SPARK_BRIDGE_API_KEY = originalBridgeKey;
}

describe('/api/prd-bridge/write integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-prd-write-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		process.env.SPARK_BRIDGE_API_KEY = BRIDGE_TEST_KEY;
	});

	afterEach(async () => {
		await resetTestSpawnerDir();
	});

	it('writes deterministic fallback analysis when hosted provider cannot start an auto worker', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'tg-build-smoke-fallback-test';
		const traceRef = 'trace:spawner-prd:mission-tg-build-smoke-fallback-test';
		const capabilityProposalPacket = {
			schema_version: 'spark.capability_proposal.v1',
			status: 'proposal_plan_only',
			implementation_route: 'domain_chip',
			owner_system: 'Spark domain chip runtime',
			capability_ledger_key: 'domain_chip:cafe-memory-reporter'
		};
		const runnerCapability = {
			runnerWritable: 'no',
			runnerLabel: 'telegram-chat-runner',
			failureReason: 'read-only preflight failed',
			checkedAt: '2026-05-10T00:00:00.000Z'
		};

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: '# Cafe Landing Page\n\nBuild mode: direct\n\nBuild a tiny static landing page for a cafe with a menu section.',
					requestId,
					projectName: 'Cafe Landing Page',
					buildMode: 'direct',
					tier: 'pro',
					chatId: 'telegram-chat-1',
					userId: 'telegram-user-1',
					traceRef,
					runnerCapability,
					capabilityProposalPacket
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.autoAnalysis).toMatchObject({ provider: 'zai', started: false });
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);
		const storedResult = JSON.parse(await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8'));
		expect(storedResult.traceRef).toBe(traceRef);
		expect(storedResult.metadata.traceRef).toBe(traceRef);
		expect(storedResult.instructionTextRedacted).toBe(true);
		expect(storedResult.executionPrompt).toBeUndefined();
		const pendingMeta = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));
		expect(pendingMeta.traceRef).toBe(traceRef);
		expect(pendingMeta.relay.traceRef).toBe(traceRef);
		expect(pendingMeta.runnerCapability).toMatchObject(runnerCapability);
		expect(pendingMeta.relay.runnerCapability).toMatchObject(runnerCapability);
		expect(pendingMeta.capabilityProposalPacket).toMatchObject(capabilityProposalPacket);
		expect(pendingMeta.capabilityProposalSummary).toMatchObject({
			schemaVersion: 'spark.capability_proposal.v1',
			status: 'proposal_plan_only',
			implementationRoute: 'domain_chip',
			ledgerKey: 'domain_chip:cafe-memory-reporter',
			ownerSystem: 'Spark domain chip runtime'
		});
	});

	it('keeps exact two-file static proofs deterministic and scoped to the requested folder', async () => {
		const requestId = 'tg-build-static-proof-s';
		const traceRef = 'trace:spawner-prd:mission-static-proof-s';
		const targetFolder = 'C:\\Users\\USER\\Desktop\\spark-os-proof-s';

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: [
						`Create a local-only static proof in ${targetFolder}.`,
						'You must create exactly two files and no others: index.html and README.md.',
						'Do not create app.js, styles.css, package.json, assets, folders, or any extra file.',
						'Put all styling inline inside index.html.'
					].join(' '),
					requestId,
					projectName: 'Spark OS Proof S',
					buildMode: 'direct',
					tier: 'pro',
					chatId: 'telegram-chat-1',
					userId: 'telegram-user-1',
					traceRef
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.autoAnalysis).toMatchObject({ provider: 'deterministic-static', started: false });
		const storedText = await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8');
		const storedResult = JSON.parse(storedText);
		expect(storedResult.projectType).toBe('static-exact-file-proof');
		expect(storedResult.executionPrompt).toBeUndefined();
		expect(storedResult.tasks[0].workspaceTargets).toEqual([targetFolder]);
		expect(storedResult.tasks[0].acceptanceCriteria[0]).toContain('index.html, README.md');
		expect(storedText).not.toContain(`${targetFolder}. You must`);
		const pendingMeta = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));
		expect(pendingMeta.projectLineage.projectPath).toBe(targetFolder);
	});
});
