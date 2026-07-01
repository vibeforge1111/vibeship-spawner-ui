import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { POST } from './+server';
import {
	buildClientGovernorDecisionAuthority,
	buildClientTurnIntentVNextAuthority
} from '$lib/services/harness-authority-client';

const { PRIVATE_ENV } = vi.hoisted(() => ({
	PRIVATE_ENV: {
		SPARK_BRIDGE_API_KEY: 'bridge-test-key',
		MCP_API_KEY: ''
	} as Record<string, string>
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

let testSpawnerDir: string;
let testChipsRoot: string;
const originalProvider = process.env.SPARK_MISSION_LLM_PROVIDER;
const originalStateDir = process.env.SPAWNER_STATE_DIR;
const originalChipsRoot = process.env.SPARK_DOMAIN_CHIPS_ROOT;
const BRIDGE_TEST_KEY = 'bridge-test-key';
const originalBridgeKey = process.env.SPARK_BRIDGE_API_KEY;

function writeAuthority(requestId: string) {
	return buildClientGovernorDecisionAuthority({
		source: 'prd-write-authority-test',
		reason: 'Focused PRD bridge write authority regression.',
		toolName: 'spawner.prd.write',
		mutationClass: 'writes_files',
		requestId,
		target: requestId
	});
}

function writeVNextAuthority(requestId: string) {
	return buildClientTurnIntentVNextAuthority({
		source: 'prd-write-authority-test',
		reason: 'Focused PRD bridge write authority regression.',
		toolName: 'spawner.prd.write',
		mutationClass: 'writes_files',
		requestId,
		target: requestId
	});
}

async function resetTestSpawnerDir() {
	if (testSpawnerDir && existsSync(testSpawnerDir)) {
		await rm(testSpawnerDir, { recursive: true, force: true });
	}
	if (testChipsRoot && existsSync(testChipsRoot)) {
		await rm(testChipsRoot, { recursive: true, force: true });
	}
	if (originalStateDir === undefined) delete process.env.SPAWNER_STATE_DIR;
	else process.env.SPAWNER_STATE_DIR = originalStateDir;
	if (originalChipsRoot === undefined) delete process.env.SPARK_DOMAIN_CHIPS_ROOT;
	else process.env.SPARK_DOMAIN_CHIPS_ROOT = originalChipsRoot;
	if (originalProvider === undefined) delete process.env.SPARK_MISSION_LLM_PROVIDER;
	else process.env.SPARK_MISSION_LLM_PROVIDER = originalProvider;
	if (originalBridgeKey === undefined) delete process.env.SPARK_BRIDGE_API_KEY;
	else process.env.SPARK_BRIDGE_API_KEY = originalBridgeKey;
}

describe('/api/prd-bridge/write integration', () => {
	beforeEach(async () => {
		await resetTestSpawnerDir();
		testSpawnerDir = await mkdtemp(path.join(tmpdir(), 'spawner-prd-write-'));
		testChipsRoot = await mkdtemp(path.join(tmpdir(), 'spawner-prd-chips-'));
		process.env.SPAWNER_STATE_DIR = testSpawnerDir;
		process.env.SPARK_DOMAIN_CHIPS_ROOT = testChipsRoot;
		process.env.SPARK_BRIDGE_API_KEY = BRIDGE_TEST_KEY;
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
	});

	afterEach(async () => {
		vi.unstubAllGlobals();
		await resetTestSpawnerDir();
	});

	it('blocks control-auth-only PRD writes before durable state or provider work', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'tg-build-no-prd-authority';

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: '# No Authority\n\nBuild a tiny static page.',
					requestId,
					projectName: 'No Authority',
					buildMode: 'direct'
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(409);
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
		expect(existsSync(path.join(testSpawnerDir, 'pending-prd.md'))).toBe(false);
		expect(existsSync(path.join(testSpawnerDir, 'pending-request.json'))).toBe(false);
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(false);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('accepts Spark bridge key for hosted Telegram PRD writes before Harness authority evaluation', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'tg-build-hosted-bridge-key-no-authority';

		const response = await POST({
			request: new Request('https://spawner.example.com/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: '# Hosted Bridge Key\n\nBuild a tiny static page.',
					requestId,
					projectName: 'Hosted Bridge Key',
					buildMode: 'direct'
				})
			}),
			getClientAddress: () => '203.0.113.10'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(409);
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
		expect(existsSync(path.join(testSpawnerDir, 'pending-prd.md'))).toBe(false);
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it('blocks bare VNext authority for PRD writes', async () => {
		const requestId = 'tg-build-vnext-prd-authority';

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: '# VNext Authority\n\nBuild a tiny static page.',
					requestId,
					projectName: 'VNext Authority',
					buildMode: 'direct',
					executionAuthority: writeVNextAuthority(requestId)
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(409);
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
		expect(existsSync(path.join(testSpawnerDir, 'pending-prd.md'))).toBe(false);
	});

	it('writes deterministic fallback analysis when hosted provider cannot start an auto worker', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'tg-build-smoke-fallback-test';
		const traceRef = 'trace:spawner-prd:mission-tg-build-smoke-fallback-test';
		const harnessProofRef = 'turn:sha256:0123456789abcdef';
		const harnessProofCapsule = {
			schema: 'spark.harness_proof.v1',
			turnRef: harnessProofRef,
			route: 'spawner.build',
			owner: 'spawner-ui',
			intent: { kind: 'spawner.build', confidence: 'high', noExecution: false },
			authority: {
				decision: 'allowed',
				contract: 'spark.turn_intent.v1',
				riskTier: 'execute',
				reasonSummary: 'Telegram build dispatch was authorized by fresh Harness authority.'
			},
			governor: { decision: 'allow', verified: true },
			execution: { status: 'started', tool: 'spawner.run', mutationClass: 'launches_mission' },
			reply: { delivered: true, shape: 'natural', rawReasonsHidden: true },
			joins: {
				telegram: 'joined',
				builder: 'not_applicable',
				spawner: 'joined',
				provider: 'not_applicable',
				memory: 'not_applicable',
				voice: 'not_applicable'
			}
		};
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
					harnessProofRef,
					harnessProofCapsule,
					runnerCapability,
					capabilityProposalPacket,
					executionAuthority: writeAuthority(requestId)
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.autoAnalysis).toMatchObject({ provider: 'zai', started: false });
		expect(body.authority).toMatchObject({ source: 'governor_decision', governorOutcome: 'execute' });
		expect(existsSync(path.join(testSpawnerDir, 'results', `${requestId}.json`))).toBe(true);
		const storedResult = JSON.parse(await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8'));
		expect(storedResult.traceRef).toBe(traceRef);
		expect(storedResult.metadata.traceRef).toBe(traceRef);
		expect(storedResult.instructionTextRedacted).toBe(true);
		expect(storedResult.executionPrompt).toBeUndefined();
		const pendingMeta = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));
		expect(pendingMeta.traceRef).toBe(traceRef);
		expect(pendingMeta.harnessProofRef).toBe(harnessProofRef);
		expect(pendingMeta.proofCapsule).toMatchObject({ schema: 'spark.harness_proof.v1', turnRef: harnessProofRef });
		expect(pendingMeta.relay.traceRef).toBe(traceRef);
		expect(pendingMeta.relay.harnessProofRef).toBe(harnessProofRef);
		expect(pendingMeta.relay.proofCapsule).toMatchObject({ schema: 'spark.harness_proof.v1', turnRef: harnessProofRef });
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
		const traceRows = (await readFile(path.join(testSpawnerDir, 'prd-auto-trace.jsonl'), 'utf-8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(traceRows.length).toBeGreaterThan(0);
		expect(traceRows.every((row) => row.harnessProofRef === harnessProofRef)).toBe(true);
		expect(traceRows.every((row) => row.proofCapsule?.schema === 'spark.harness_proof.v1')).toBe(true);
		expect(traceRows.every((row) => row.proofCapsule?.turnRef === harnessProofRef)).toBe(true);
		expect(traceRows.every((row) => row.proofStatus === undefined)).toBe(true);
		const serializedTraceRows = JSON.stringify(traceRows);
		expect(serializedTraceRows).not.toContain(testSpawnerDir);
		expect(serializedTraceRows).not.toMatch(/\/Users\/|\/var\/folders\/|file:\/\//);
		expect(serializedTraceRows).toMatch(/path:sha256:[a-f0-9]{16}/);
		expect(traceRows.find((row) => row.event === 'fallback_analysis_written')?.resultFile).toMatch(
			/^path:sha256:[a-f0-9]{16}$/
		);
	});

	it('persists PRD Writing distilled reuse metadata through the real write route', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'spawner-prd-distilled-reuse-route-test';
		const chipRoot = path.join(testChipsRoot, 'domain-chip-prd-writing-proof-loop');
		await mkdir(path.join(chipRoot, 'distilled-runtime'), { recursive: true });
		await writeFile(
			path.join(chipRoot, 'spark-chip.json'),
			JSON.stringify({
				chip_name: 'domain-chip-prd-writing-proof-loop',
				domain: 'PRD Writing',
				commands: {
					'loop-round': {},
					'long-loop-trend': { required_rounds: 5 }
				}
			}),
			'utf-8'
		);
		await writeFile(
			path.join(chipRoot, 'distilled-runtime', 'prd-writing-fast-path.json'),
			JSON.stringify({
				runtime_state: 'private_candidate_local_telegram_handler_passed_live_telegram_proven',
				runtime_path: 'distilled-runtime/prd-writing-fast-path.json',
				distilled_lessons: [
					'Start PRDs with user, problem, value, scope, non-goals, workflow, data, risks, acceptance tests, and benchmark plan.',
					'Ask only the missing questions that materially change product behavior, then draft with explicit assumptions.'
				],
				reloop_triggers: ['held-out PRD case score drops below 8.0']
			}),
			'utf-8'
		);

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: [
						'# Invoice Export Reliability PRD',
						'Write a PRD for reducing invoice export failures for finance admins after CSV jobs time out.',
						'Include owner, affected user, problem, scope, non-goals, acceptance tests, rollback, launch risk, and benchmark plan.',
						'Use the PRD Writing domain chip guidance if it fits, but do not run a benchmark, loop, schedule, activation, mission, or publication.'
					].join('\n\n'),
					requestId,
					projectName: 'Invoice Export Reliability PRD',
					buildMode: 'advanced_prd',
					buildLane: 'advanced_prd',
					tier: 'pro',
					forceDispatch: true,
					executionAuthority: writeAuthority(requestId)
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		const body = await response.json();
		expect(response.status).toBe(200);
		expect(body.autoAnalysis).toMatchObject({ provider: 'zai', started: false });
		const storedResult = JSON.parse(await readFile(path.join(testSpawnerDir, 'results', `${requestId}.json`), 'utf-8'));
		expect(storedResult.executionPrompt).toBeUndefined();
		expect(storedResult.instructionTextRedacted).toBe(true);
		expect(storedResult.metadata.loopEngineering).toMatchObject({
			appliedChipId: 'domain-chip-prd-writing-proof-loop',
			source: 'loop-engineering-chip',
			noLoopRerun: true,
			reloopTriggers: ['held-out PRD case score drops below 8.0'],
			reusedDistilledLessons: expect.arrayContaining([
				expect.stringContaining('Start PRDs with user, problem, value')
			])
		});
	});

	it('persists rejected target path intent as evidence without project lineage authority', async () => {
		process.env.SPARK_MISSION_LLM_PROVIDER = 'zai';
		const requestId = 'tg-build-rejected-path-evidence';
		const requestedProjectPath = 'C:\\tmp\\spark-generated\\outside-root';

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: '# Outside Root App\n\nBuild a compact dashboard. The executable path was rejected before dispatch and must not be used as project lineage.',
					requestId,
					projectName: 'Outside Root App',
					buildMode: 'direct',
					tier: 'pro',
					chatId: 'telegram-chat-1',
					userId: 'telegram-user-1',
					forceDispatch: true,
					projectPathEvidence: {
						requestedProjectPath,
						usedProjectPath: null,
						evidenceOnly: true,
						rejectedReason: 'outside_configured_workspace_root'
					},
					executionAuthority: writeAuthority(requestId)
				})
			}),
			getClientAddress: () => '127.0.0.1'
		} as never);

		expect(response.status).toBe(200);
		const pendingMeta = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));
		expect(pendingMeta.projectLineage).toBeNull();
		expect(pendingMeta.projectPathEvidence).toEqual({
			requestedProjectPath,
			usedProjectPath: null,
			evidenceOnly: true,
			rejectedReason: 'outside_configured_workspace_root'
		});
		expect(pendingMeta.relay.projectPathEvidence).toEqual(pendingMeta.projectPathEvidence);
		const traceRows = (await readFile(path.join(testSpawnerDir, 'prd-auto-trace.jsonl'), 'utf-8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(traceRows.find((row) => row.event === 'request_written')).toMatchObject({
			projectPathEvidence: {
				hasRequestedProjectPath: true,
				usedProjectPath: false,
				evidenceOnly: true,
				rejectedReason: 'outside_configured_workspace_root'
			}
		});
	});

	it('keeps exact two-file static proofs deterministic and scoped to the requested folder', async () => {
		const requestId = 'tg-build-static-proof-s';
		const traceRef = 'trace:spawner-prd:mission-static-proof-s';
		const targetFolder = path.join(testSpawnerDir, 'spark-os-proof-s');
		const proofMarker = 'SPARK_OS_TEST_STATIC_PROOF_S';
		const proofSentence = 'Spawner trace parity runtime proof';

		const response = await POST({
			request: new Request('http://localhost/api/prd-bridge/write', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_TEST_KEY },
				body: JSON.stringify({
					content: [
						`Create a local-only static proof in ${targetFolder}.`,
						'You must create exactly 2 local proof files and no others: index.html and README.md.',
						'Do not create app.js, styles.css, package.json, assets, folders, or any extra file.',
						'Put all styling inline inside index.html.',
						`Include the visible marker ${proofMarker} in both files.`,
						`Include the exact sentence "${proofSentence}" in both files.`
					].join(' '),
					requestId,
					projectName: 'Spark OS Proof S',
					buildMode: 'direct',
					tier: 'pro',
					chatId: 'telegram-chat-1',
					userId: 'telegram-user-1',
					traceRef,
					executionAuthority: writeAuthority(requestId)
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
		expect(await readFile(path.join(targetFolder, 'index.html'), 'utf-8')).toContain(proofMarker);
		expect(await readFile(path.join(targetFolder, 'index.html'), 'utf-8')).toContain(proofSentence);
		expect(await readFile(path.join(targetFolder, 'README.md'), 'utf-8')).toContain(proofMarker);
		expect(await readFile(path.join(targetFolder, 'README.md'), 'utf-8')).toContain(proofSentence);
		const pendingMeta = JSON.parse(await readFile(path.join(testSpawnerDir, 'pending-request.json'), 'utf-8'));
		expect(pendingMeta.projectLineage.projectPath).toBe(targetFolder);
		const traceRows = (await readFile(path.join(testSpawnerDir, 'prd-auto-trace.jsonl'), 'utf-8'))
			.trim()
			.split('\n')
			.map((line) => JSON.parse(line));
		expect(JSON.stringify(traceRows)).not.toContain(testSpawnerDir);
		expect(JSON.stringify(traceRows)).not.toContain(targetFolder);
		expect(traceRows.every((row) => row.proofStatus === 'missing_harness_authority')).toBe(true);
		expect(traceRows.every((row) => row.proofStorage === 'source_gap_capsule')).toBe(true);
		expect(traceRows.every((row) => row.proofCapsule?.schema === 'spark.harness_proof.v1')).toBe(true);
		expect(traceRows.every((row) => row.proofCapsule?.authority?.contract === 'none')).toBe(true);
		expect(traceRows.every((row) => row.proofCapsule?.governor?.verified === false)).toBe(true);
		expect(traceRows.every((row) => /^turn:sha256:[a-f0-9]{16}$/.test(row.harnessProofRef))).toBe(true);
		expect(traceRows.find((row) => row.event === 'authority_verdict_evaluated')).toMatchObject({
			traceRef,
			authorityVerdict: {
				schema_version: 'spark.authority_verdict.v1',
				traceRef,
				actionFamily: 'mission_execution',
				verdict: 'blocked',
				sourceRepo: 'spawner-ui',
				reasonCode: 'auto_provider_deterministic-static_not_started'
			}
		});
	});
});
