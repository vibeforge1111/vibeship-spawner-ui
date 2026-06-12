import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	EVENTS_API_KEY: 'watchdog-probe-route-test-secret',
	MCP_API_KEY: ''
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { GET } from './+server';
import { buildServerGovernorDecisionAuthority } from '$lib/server/harness-authority';
import { relayMissionControlEvent } from '$lib/server/mission-control-relay';
import {
	providerRuntime,
	type ProviderMissionResultSnapshot
} from '$lib/server/provider-runtime';
import type { ProviderSessionStatus } from '$lib/server/provider-clients/types';
import { watchdogProbeBoardSchema } from '$lib/services/harness-watchdog';

const requestId = 'tg-build-02c441099b20-1780867252235';
const missionId = 'mission-1780867252235';
const traceRef = 'trace:spawner-prd:mission-1780867252235';
const checkedAt = '2026-06-07T22:30:00.000Z';
const TEST_API_KEY = 'watchdog-probe-route-test-secret';

let stateDir: string;

function event(url: string, address = '127.0.0.1', init?: RequestInit) {
	return {
		request: new Request(url, init),
		url: new URL(url),
		getClientAddress: () => address
	};
}

function authenticatedEvent(url: string, address = '127.0.0.1') {
	return event(url, address, { headers: { 'x-api-key': TEST_API_KEY } });
}

function dispatchAuthority() {
	return buildServerGovernorDecisionAuthority({
		source: 'watchdog-probe-route-test',
		reason: 'Operator requested a focused watchdog probe route test.',
		toolName: 'spawner.dispatch',
		mutationClass: 'launches_mission',
		requestId,
		target: missionId
	});
}

function providerResult(overrides: Partial<ProviderMissionResultSnapshot> = {}): ProviderMissionResultSnapshot {
	return {
		providerId: 'codex',
		status: 'running',
		response: 'raw provider output must not leak',
		error: null,
		durationMs: null,
		tokenUsage: null,
		startedAt: checkedAt,
		completedAt: null,
		...overrides
	};
}

async function writeJson(relativePath: string, value: unknown) {
	const filePath = path.join(stateDir, relativePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function writeProbeState() {
	await mkdir(path.join(stateDir, 'results'), { recursive: true });
	await writeJson('pending-request.json', {
		requestId,
		missionId,
		traceRef,
		status: 'canvas_loaded',
		relay: {
			requestId,
			missionId,
			traceRef,
			chatId: '8319079055',
			userId: '8319079055',
			goal: 'Do not expose this route test prompt.',
			telegramRelay: { port: 8791, profile: 'spark-recursive' }
		}
	});
	await writeJson(`results/${requestId}.json`, {
		requestId,
		missionId,
		traceRef,
		success: true,
		projectName: 'Small Harness Watchdog Probe Board',
		tasks: [{ id: 'task-1', title: 'Define board contract' }],
		executionPrompt: 'Do not expose this provider prompt.'
	});
	await writeJson('last-canvas-load.json', {
		requestId,
		missionId,
		traceRef,
		pipelineId: `prd-${requestId}`,
		pipelineName: 'Small Harness Watchdog Probe Board',
		source: 'prd-bridge',
		canvasLoadedAt: checkedAt,
		nodes: [{ id: 'task-1' }],
		relay: {
			requestId,
			missionId,
			traceRef,
			telegramRelay: { port: 8791, profile: 'spark-recursive' }
		}
	});
	await writeJson('pending-load.json', {
		requestId,
		missionId,
		traceRef,
		timestamp: checkedAt,
		executionAuthority: dispatchAuthority()
	});
	await relayMissionControlEvent({
		type: 'mission_created',
		missionId,
		source: 'prd-bridge',
		data: {
			requestId,
			traceRef,
			plannedTasks: [{ title: 'Define board contract', skills: ['typescript-strict'] }],
			telegramRelay: { port: 8791, profile: 'spark-recursive' }
		}
	});
	await relayMissionControlEvent({
		type: 'task_started',
		missionId,
		taskName: 'Define board contract',
		source: 'codex',
		data: { requestId, traceRef, telegramRelay: { port: 8791, profile: 'spark-recursive' } }
	});
}

describe('/api/harness-watchdog/probe integration', () => {
	beforeEach(async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
		stateDir = await mkdtemp(path.join(tmpdir(), 'harness-watchdog-probe-route-'));
		PRIVATE_ENV.EVENTS_API_KEY = TEST_API_KEY;
		PRIVATE_ENV.MCP_API_KEY = '';
		process.env.SPAWNER_STATE_DIR = stateDir;
		vi.spyOn(providerRuntime, 'getMissionStatus').mockImplementation((id) => ({
			allComplete: false,
			anyFailed: false,
			paused: false,
			pausedReason: null,
			lastReason: id === missionId ? 'Dispatch started' : null,
			snapshotAvailable: id === missionId,
			resumeable: false,
			resumeBlocker: null,
			providers: id === missionId ? { codex: 'running' } : ({} as Record<string, ProviderSessionStatus>)
		}));
		vi.spyOn(providerRuntime, 'getMissionResults').mockImplementation((id) =>
			id === missionId ? [providerResult()] : []
		);
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		PRIVATE_ENV.EVENTS_API_KEY = TEST_API_KEY;
		PRIVATE_ENV.MCP_API_KEY = '';
		delete process.env.SPAWNER_STATE_DIR;
		await rm(stateDir, { recursive: true, force: true });
	});

	it('returns a complete redacted board payload by requestId', async () => {
		await writeProbeState();

		const response = await GET(
			authenticatedEvent(`http://127.0.0.1/api/harness-watchdog/probe?requestId=${requestId}`) as never
		);

		expect(response.status).toBe(200);
		const payload = await response.json();
		watchdogProbeBoardSchema.parse(payload);
		expect(payload).toMatchObject({
			schemaVersion: 'spark.spawner.watchdog_probe_board.v1',
			requestId,
			missionId,
			traceRef,
			source: 'spawner-ui'
		});
		expect(payload.runtimeHealth.length).toBeGreaterThan(0);
		expect(payload.authorityGates.length).toBeGreaterThan(0);
		expect(payload.telegramProof.length).toBeGreaterThan(0);
		expect(payload.registryDrift.length).toBeGreaterThan(0);
		expect(payload.rollbackNotes.length).toBeGreaterThan(0);
		const text = JSON.stringify(payload);
		expect(text).not.toContain('8319079055');
		expect(text).not.toContain('Do not expose this route test prompt');
		expect(text).not.toContain('raw provider output must not leak');
		expect(text).not.toContain('executionPrompt');
	});

	it('returns a complete board payload by missionId', async () => {
		await writeProbeState();

		const response = await GET(
			authenticatedEvent(`http://127.0.0.1/api/harness-watchdog/probe?missionId=${missionId}`) as never
		);

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.missionId).toBe(missionId);
		expect(payload.openBlockers).toEqual(expect.any(Array));
	});

	it('returns safe errors for invalid IDs and missing state', async () => {
		const invalid = await GET(
			authenticatedEvent('http://127.0.0.1/api/harness-watchdog/probe?requestId=../../secret') as never
		);
		expect(invalid.status).toBe(400);
		await expect(invalid.json()).resolves.toMatchObject({ code: 'invalid_requestId' });

		const missing = await GET(
			authenticatedEvent(
				'http://127.0.0.1/api/harness-watchdog/probe?requestId=tg-build-missing-1780867259999'
			) as never
		);
		expect(missing.status).toBe(404);
		await expect(missing.json()).resolves.toMatchObject({ code: 'watchdog_state_missing' });
	});

	it('accepts MCP_API_KEY fallback when EVENTS_API_KEY is not configured', async () => {
		PRIVATE_ENV.EVENTS_API_KEY = '';
		PRIVATE_ENV.MCP_API_KEY = TEST_API_KEY;
		await writeProbeState();

		const response = await GET(
			authenticatedEvent(`http://127.0.0.1/api/harness-watchdog/probe?requestId=${requestId}`) as never
		);

		expect(response.status).toBe(200);
	});

	it('requires control auth for non-local callers', async () => {
		const response = await GET(
			event(`http://example.com/api/harness-watchdog/probe?requestId=${requestId}`, '203.0.113.9') as never
		);
		expect(response.status).toBe(401);
		const payload = await response.json();
		expect(JSON.stringify(payload)).not.toContain('8319079055');
	});
});
