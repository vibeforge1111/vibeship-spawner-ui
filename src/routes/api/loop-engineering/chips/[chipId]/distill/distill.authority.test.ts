import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServerGovernorDecisionAuthority, buildServerTurnIntentVNextAuthority } from '$lib/server/harness-authority';
import {
	executePrivateBenchmarkRun,
	listDistillations,
	recordEvaluatorReview,
	stageBenchmarkCase
} from '$lib/server/loop-engineering-control-plane';
import { POST } from './+server';

const originalSpawnerStateDir = process.env.SPAWNER_STATE_DIR;
let cleanupDir: string | null = null;

function event(body?: unknown) {
	return {
		params: { chipId: 'domain-chip-prd-writing-proof-loop' },
		request: new Request('http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/distill', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1:3333/api/loop-engineering/chips/domain-chip-prd-writing-proof-loop/distill'),
		getClientAddress: () => '127.0.0.1'
	};
}

function governorAuthority() {
	return buildServerGovernorDecisionAuthority({
		source: 'loop-engineering-distill-test',
		reason: 'Focused Loop Engineering distillation regression.',
		toolName: 'spawner.loop_engineering.distill.stage',
		mutationClass: 'writes_files',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

function bareVNextAuthority() {
	return buildServerTurnIntentVNextAuthority({
		source: 'loop-engineering-distill-test',
		reason: 'Focused Loop Engineering distillation regression.',
		toolName: 'spawner.loop_engineering.distill.stage',
		mutationClass: 'writes_files',
		actorKind: 'human',
		actorIdRef: 'spawner-ui.test'
	});
}

async function seedEvaluatorEvent() {
	const staged = await stageBenchmarkCase({
		chipKey: 'domain-chip-prd-writing-proof-loop',
		kind: 'visible',
		prompt: 'Write a PRD for billing reminders.',
		expectedBehavior: 'Include owner, affected users, success metric, acceptance criteria, risks, rollback, and evidence refs.'
	});
	const source = await executePrivateBenchmarkRun({
		chipKey: 'domain-chip-prd-writing-proof-loop',
		benchmarkCaseIds: [staged.caseRecord.id]
	});
	const result = await recordEvaluatorReview({
		chipKey: 'domain-chip-prd-writing-proof-loop',
		sourceRunEventId: source.event.id,
		previousScore: source.event.previousScore,
		candidateScore: source.event.candidateScore,
		roundsObserved: source.event.roundsObserved,
		evaluatorSeparated: true,
		evidenceRefs: ['reports/prd-eval.json']
	});
	return result.event;
}

describe('/api/loop-engineering/chips/[chipId]/distill', () => {
	beforeEach(async () => {
		cleanupDir = await mkdtemp(path.join(os.tmpdir(), 'spawner-loop-distill-route-'));
		process.env.SPAWNER_STATE_DIR = cleanupDir;
	});

	afterEach(async () => {
		if (originalSpawnerStateDir) process.env.SPAWNER_STATE_DIR = originalSpawnerStateDir;
		else delete process.env.SPAWNER_STATE_DIR;
		if (cleanupDir) await rm(cleanupDir, { recursive: true, force: true });
		cleanupDir = null;
	});

	it('blocks distillation without native Governor authority', async () => {
		const evaluator = await seedEvaluatorEvent();
		const response = await POST(event({
			sourceEvaluatorEventId: evaluator.id,
			lessons: ['Clarify success metrics before writing the PRD.']
		}) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.code).toBe('harness_authority_blocked');
		expect(body.authority.reasonCodes).toContain('missing_harness_authority');
	});

	it('blocks bare VNext distillation authority', async () => {
		const evaluator = await seedEvaluatorEvent();
		const response = await POST(event({
			sourceEvaluatorEventId: evaluator.id,
			lessons: ['Clarify success metrics before writing the PRD.'],
			executionAuthority: bareVNextAuthority()
		}) as never);
		expect(response.status).toBe(409);
		const body = await response.json();
		expect(body.authority.source).toBe('turn_intent_vnext');
		expect(body.authority.reasonCodes).toContain('native_governor_required');
	});

	it('stages distillation only from passed separated evaluator evidence', async () => {
		const evaluator = await seedEvaluatorEvent();
		const response = await POST(event({
			sourceEvaluatorEventId: evaluator.id,
			lessons: ['Resolve user, owner, success metric, and acceptance criteria before detailed scope.'],
			runtimeNotes: 'Use as staged PRD Writing guidance after activation review.',
			tokenBudgetHint: 'Try the distilled checklist before a full loop.',
			sourceSurface: 'telegram',
			executionAuthority: governorAuthority()
		}) as never);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.distillation).toMatchObject({
			chipKey: 'domain-chip-prd-writing-proof-loop',
			sourceEvaluatorEventId: evaluator.id,
			status: 'staged'
		});
		expect(body.event).toMatchObject({
			eventType: 'distillation',
			status: 'passed',
			sourceSurface: 'telegram',
			evaluatorSeparated: true
		});
		expect(body.commandResult).toMatchObject({
			action: 'distillation_staged',
			changed: true,
			launchedMission: false,
			eventId: body.event.id
		});
		expect(body.commandResult.userMessage).toContain('staged for future PRDs');
		const distillations = await listDistillations('domain-chip-prd-writing-proof-loop');
		expect(distillations).toHaveLength(1);
	});
});
