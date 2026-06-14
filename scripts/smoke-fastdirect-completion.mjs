#!/usr/bin/env node

import {
	createHarnessCoreActionEnvelopeVNext,
	createHarnessCoreAuthorizedGovernorDecision,
	signHarnessCoreGovernorDecision
} from '@spark/harness-core';
import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(filePath) {
	if (!filePath || !existsSync(filePath)) return;
	for (const line of readFileSync(filePath, 'utf-8').split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
		if (!match) continue;
		const [, key, rawValue] = match;
		const value = rawValue.trim().replace(/^["']|["']$/g, '');
		if (value) process.env[key] = value;
	}
}

loadEnvFile(process.env.SPAWNER_SMOKE_ENV_FILE);
loadEnvFile('.env');

const baseUrl = (process.env.SPAWNER_SMOKE_BASE_URL || 'http://127.0.0.1:3333').replace(/\/+$/, '');
const apiKey =
	process.env.SPARK_BRIDGE_API_KEY ||
	process.env.SPAWNER_PRD_API_KEY ||
	process.env.MCP_API_KEY ||
	process.env.EVENTS_API_KEY ||
	'';
const stamp = Date.now();
const requestId = `tg-build-fastdirect-smoke-${stamp}`;
const missionId = `mission-${stamp}`;
const projectName = 'Fast Direct Completion Smoke';
const traceRef = `trace:spawner-prd:${missionId}`;

function url(path) {
	return `${baseUrl}${path}`;
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function parseJson(text, path) {
	try {
		return JSON.parse(text);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`${path} returned malformed JSON: ${message}; body=${text.slice(0, 300)}`);
	}
}

async function postJson(path, body) {
	const headers = { 'Content-Type': 'application/json' };
	if (apiKey) headers['x-api-key'] = apiKey;
	const response = await fetch(url(path), {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});
	const text = await response.text();
	if (!response.ok) {
		const authHint = response.status === 401 && !apiKey
			? ' Set SPARK_BRIDGE_API_KEY, SPAWNER_PRD_API_KEY, MCP_API_KEY, or EVENTS_API_KEY for locked write routes.'
			: '';
		throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}${authHint}`);
	}
	return parseJson(text, path);
}

async function getJson(path) {
	const response = await fetch(url(path));
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
	}
	return parseJson(text, path);
}

async function waitFor(description, probe, timeoutMs = 8000) {
	const started = Date.now();
	let lastError = null;
	while (Date.now() - started < timeoutMs) {
		try {
			const result = await probe();
			if (result) return result;
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	throw new Error(`${description} did not become true${lastError ? `: ${lastError.message}` : ''}`);
}

function buildWriteAuthority() {
	const envelope = createHarnessCoreActionEnvelopeVNext({
		surface: 'spawner',
		ownerSystem: 'spawner-ui',
		source: 'smoke-fastdirect-completion',
		reason: 'Verify fast_direct completion relay contract.',
		toolName: 'spawner.prd.write',
		mutationClass: 'writes_files',
		requestId,
		target: requestId,
		externalNetwork: false,
		publishes: false,
		confidence: 0.95
	});
	const decision = createHarnessCoreAuthorizedGovernorDecision({
		envelope,
		tool_name: 'spawner.prd.write',
		restrictions: {
			network_allowed: false,
			write_allowed: true,
			publish_allowed: false
		}
	});
	const key = (process.env.SPARK_GOVERNOR_HMAC_KEY || '').trim();
	if (!key) return decision;
	return signHarnessCoreGovernorDecision(decision, {
		key,
		key_id: (process.env.SPARK_GOVERNOR_HMAC_KEY_ID || '').trim() || 'local'
	});
}

const writeBody = await postJson('/api/prd-bridge/write', {
	content:
		'Create one-file only index.html. Keep it as static HTML only. Build a countdown timer page. No package.json. Do not make a full app.',
	requestId,
	projectName,
	buildMode: 'direct',
	buildLane: 'fast_direct',
	options: { fastLane: true },
	tier: 'pro',
	chatId: 'smoke-chat',
	userId: 'smoke-user',
	traceRef,
	executionAuthority: buildWriteAuthority()
});

assert(writeBody?.success === true, 'fast_direct write did not succeed');
assert(writeBody?.autoAnalysis?.provider === 'deterministic-fast-lane', `unexpected provider ${writeBody?.autoAnalysis?.provider}`);
assert(writeBody?.autoAnalysis?.started === false, 'fast_direct smoke should not dispatch a provider worker');

const status = await waitFor('fast_direct completion relay events', async () => {
	const body = await getJson(`/api/mission-control/status?missionId=${encodeURIComponent(missionId)}`);
	const recent = Array.isArray(body?.snapshot?.recent) ? body.snapshot.recent : [];
	const events = recent.filter((entry) => entry.requestId === requestId);
	const taskCompleted = events.find((entry) => entry.eventType === 'task_completed');
	const missionCompleted = events.find((entry) => entry.eventType === 'mission_completed');
	if (!taskCompleted || !missionCompleted) return null;
	return { taskCompleted, missionCompleted, events };
});

const completionEvents = status.events.filter((entry) =>
	['task_completed', 'mission_completed'].includes(entry.eventType)
);
assert(
	completionEvents.filter((entry) => entry.eventType === 'task_completed').length === 1,
	'expected exactly one task_completed event'
);
assert(
	completionEvents.filter((entry) => entry.eventType === 'mission_completed').length === 1,
	'expected exactly one mission_completed event'
);
assert(status.missionCompleted.traceRef === traceRef, `traceRef mismatch: ${status.missionCompleted.traceRef}`);
assert(
	status.missionCompleted.providerId === 'deterministic-fast-lane',
	`provider mismatch: ${status.missionCompleted.providerId}`
);

const trace = await waitFor('fast_direct trace completion', async () => {
	const body = await getJson(
		`/api/mission-control/trace?missionId=${encodeURIComponent(missionId)}&requestId=${encodeURIComponent(requestId)}`
	);
	return body?.phase === 'completed' ? body : null;
});

assert(trace.progress?.percent === 100, `trace progress was ${trace.progress?.percent}`);
assert(
	Array.isArray(trace.timeline) && trace.timeline.some((entry) => entry.eventType === 'mission_completed'),
	'trace timeline did not include mission_completed'
);

console.log(`PASS fast_direct completion smoke requestId=${requestId} missionId=${missionId}`);
