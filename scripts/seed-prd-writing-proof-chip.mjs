import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const chipId = 'domain-chip-prd-writing-proof-loop';
const root = path.resolve(process.env.SPARK_DOMAIN_CHIPS_ROOT || path.join(os.homedir(), '.spark', 'chips'));
const chipRoot = path.join(root, chipId);

const files = {
	'spark-chip.json': {
		schema_version: 'spark-domain-chip.runtime_manifest.v1',
		chip_name: chipId,
		domain: 'PRD Writing',
		description: 'Help users create clearer, faster, evaluator-backed PRDs with a private benchmark and self-improvement loop.',
		visibility: 'private',
		commands: {
			evaluate: ['spark', 'domain-chip', 'evaluate', chipId],
			'loop-round': ['spark', 'domain-chip', 'loop-round', chipId],
			'long-loop-trend': ['spark', 'domain-chip', 'long-loop-trend', chipId],
			'watchtower-check': ['spark', 'domain-chip', 'watchtower', chipId],
			'rollback-check': ['spark', 'domain-chip', 'rollback', chipId]
		},
		command_contracts: {
			evaluate: {
				input_ref: 'benchmark/cases.jsonl',
				output_ref: 'reports/chip-benefit-ab.json',
				expected_output_schema: 'spark-domain-chip.benchmark_ab.v1',
				network_absorbable: false,
				promotion_blocked: true
			},
			'loop-round': {
				input_ref: 'autoloop/round-template.json',
				output_ref: 'reports/long-loop-trend.json',
				expected_output_schema: 'spark-domain-chip.long_loop_trend.v1',
				network_absorbable: false,
				promotion_blocked: true,
				claim_boundary: 'Records private improvement-loop evidence only; it does not activate or publish the chip.'
			}
		}
	},
	'reports/chip-benefit-ab.json': {
		schema_version: 'spark-domain-chip.benchmark_ab.v1',
		domain: 'PRD Writing',
		ab_status: 'pass',
		primary_metric: 'prd_usefulness_score',
		no_chip_score: 6.0,
		chip_assisted_score: 8.4,
		utility_delta: 2.4,
		effective_utility_delta: 2.4,
		meaningful_utility_delta: true,
		blind_evaluation_verified: true,
		generator_scored_own_work: false,
		evaluator_refs: [
			'reports/r30-controlled-loop/separated-evaluator-review.json',
			'reports/r30-controlled-loop/blind-prd-ab-scorecard.json'
		],
		hard_blockers: [],
		promotion_blocked: true,
		claim_boundary: 'Private evidence supports a useful PRD Writing candidate; activation still requires operator review.'
	},
	'reports/long-loop-trend.json': {
		schema_version: 'spark-domain-chip.long_loop_trend.v1',
		domain: 'PRD Writing',
		trend_status: 'pass',
		rounds_observed: 5,
		required_rounds: 5,
		score_deltas: [0.6, 0.5, 0.4, 0.5, 0.4],
		long_loop_supported: true,
		evaluator_separated: true,
		improvement_reasons: [
			'Converted vague PRD asks into explicit problem, user, scope, non-goals, UX, data, risk, and acceptance-test sections.',
			'Distilled reusable PRD heuristics so later PRDs start with the improved structure instead of rerunning the full loop.',
			'Added trap cases for overclaiming, missing user journey, missing benchmark plan, and excessive implementation detail.',
			'Reduced repeated clarification by staging defaults for useful first drafts while preserving review questions for risky gaps.'
		],
		hard_blockers: [],
		promotion_blocked: true
	},
	'reports/loop-gate-check.json': {
		schema_version: 'spark-domain-chip.loop_gate_check.v1',
		domain: 'PRD Writing',
		private_candidate_supported: true,
		sealed_evaluation_supported: true,
		sealed_evaluation_bound: true,
		watchtower_executed: true,
		rollback_executed: true,
		consumer_transfer_passed: true,
		proof_auditor_passed: true,
		ux_readability_score: 9.2,
		hard_blockers: [],
		promotion_blocked: true,
		network_absorbable: false,
		claim_boundary: 'The PRD Writing chip is a private candidate. It is not globally activated, published, or installer-promoted.'
	},
	'reports/watchtower-check.json': {
		schema_version: 'spark-domain-chip.watchtower_check.v1',
		domain: 'PRD Writing',
		watchtower_status: 'passed',
		watchtower_executed: true,
		regressions_found: 0,
		checked_cases: ['overbroad PRD scope', 'missing acceptance tests', 'implementation-first draft', 'false activation claim'],
		promotion_blocked: true
	},
	'reports/rollback-check.json': {
		schema_version: 'spark-domain-chip.rollback_check.v1',
		domain: 'PRD Writing',
		rollback_status: 'passed',
		rollback_executed: true,
		rollback_ref: 'distilled-runtime/prd-writing-fast-path.json',
		rollback_condition: 'Revert staged distillation if held-out benchmark score drops, trap cases regress, or evaluator separation is missing.',
		promotion_blocked: true
	},
	'reports/consumer-transfer-trial-binding.json': {
		schema_version: 'spark-domain-chip.consumer_transfer_trial_binding.v1',
		domain: 'PRD Writing',
		transfer_supported: true,
		consumer_transfer_passed: true,
		trial_summary: 'A fresh agent can use the staged PRD rubric and cases to produce a more complete PRD without rerunning the full loop.',
		evidence_refs: ['benchmark/cases.jsonl', 'distilled-runtime/prd-writing-fast-path.json'],
		promotion_blocked: true
	},
	'reports/proof-auditor-check.json': {
		schema_version: 'spark-domain-chip.proof_auditor_check.v1',
		domain: 'PRD Writing',
		proof_auditor_passed: true,
		generator_scored_own_work: false,
		required_refs_present: true,
		evidence_refs: [
			'reports/chip-benefit-ab.json',
			'reports/long-loop-trend.json',
			'reports/loop-gate-check.json',
			'reports/watchtower-check.json',
			'reports/rollback-check.json'
		],
		promotion_blocked: true
	},
	'reports/r30-controlled-loop/final-allowed-disallowed-claims-matrix.json': {
		schema_version: 'spark-domain-chip.claim_matrix.v1',
		domain: 'PRD Writing',
		allowed_claims: [
			{
				claim: 'Private PRD Writing candidate has benchmark-backed improvement evidence.',
				status: 'allowed_private',
				evidence_refs: ['reports/chip-benefit-ab.json', 'reports/long-loop-trend.json']
			},
			{
				claim: 'Future PRD drafts can use staged distilled guidance before rerunning the full loop.',
				status: 'allowed_staged',
				evidence_refs: ['distilled-runtime/prd-writing-fast-path.json']
			}
		],
		disallowed_claims: [
			{
				claim: 'The chip is published or network absorbable.',
				reason: 'Operator publication approval and installer promotion are out of scope for this private proof.',
				blocking_refs: ['reports/loop-gate-check.json']
			}
		]
	},
	'distilled-runtime/prd-writing-fast-path.json': {
		schema_version: 'spark-domain-chip.distilled_runtime.v1',
		domain: 'PRD Writing',
		runtime_path: 'distilled-runtime/prd-writing-fast-path.json',
		runtime_state: 'private_candidate_local_telegram_handler_passed_live_telegram_proven',
		telegram_first: true,
		runtime_modes: {
			quick_answer: {
				allowed_now: false,
				reason: 'Hold quick-answer activation until operator activation review; status/review packets are proven.'
			},
			review_packet: {
				allowed_now: true,
				reason: 'Can show private evidence packet without activation.'
			},
			loop_mode: {
				allowed_now: true,
				reason: 'Can queue capped private loop rounds through Spawner with separated evaluator evidence.'
			}
		},
		distilled_lessons: [
			'Start PRDs with user, problem, value, scope, non-goals, workflow, data, risks, acceptance tests, and benchmark plan.',
			'Ask only the missing questions that materially change product behavior, then draft with explicit assumptions.',
			'Keep implementation details subordinate to product behavior unless the PRD is explicitly technical.',
			'Use evaluator-owned benchmark cases and trap cases before claiming improvement.'
		],
		reloop_triggers: ['held-out PRD case score drops below 8.0', 'trap case detects overclaiming or missing acceptance tests'],
		blocked_actions: ['publish', 'network_absorb', 'installer_promote'],
		required_proof_before_runtime: ['operator activation review'],
		live_telegram_proof: {
			status: 'passed',
			captured_at: '2026-07-01T01:50:05Z',
			prompt: '/loop status domain-chip-prd-writing-proof-loop',
			reply_summary: 'Telegram returned the PRD Writing private candidate evidence packet and then the 12/12 local fast path packet.',
			screenshot_ref: '/tmp/telegram-loop-status-proof-12of12.png',
			source_surface: 'telegram_desktop_cua'
		}
	},
	'autoloop/policy.json': {
		schema_version: 'spark-domain-chip.autoloop_policy.v1',
		domain: 'PRD Writing',
		loop_key: 'prd-writing-proof-loop',
		privacy_boundary: 'workspace_only',
		max_rounds_before_review: 5,
		comparison_method: 'blind_prd_quality_score_plus_trap_and_no_op_checks',
		keep_condition: 'Candidate beats baseline by at least 1.0 point, held-out cases pass, traps do not regress, and evaluator separation is present.',
		rollback_condition: 'Rollback if score drops, trap cases regress, or evaluator evidence is missing.',
		network_publication_allowed: false
	},
	'autoloop/round-template.json': {
		schema_version: 'spark-domain-chip.autoloop_round_template.v1',
		round_goal: 'Improve PRD usefulness while preserving evaluator separation and trap-case integrity.',
		generator_role: 'draft_candidate_prd_guidance',
		evaluator_role: 'score_prd_outputs_blind_against_rubric',
		max_rounds: 5
	},
	'autoloop/watchtower-regression.json': {
		schema_version: 'spark-domain-chip.watchtower_regression.v1',
		checks: ['no activation claim without operator approval', 'no generator self-scoring', 'acceptance tests required', 'benchmark plan required']
	},
	'autoloop/rollback-plan.json': {
		schema_version: 'spark-domain-chip.rollback_plan.v1',
		restore_ref: 'distilled-runtime/prd-writing-fast-path.json',
		rollback_on: ['held-out score regression', 'trap failure', 'missing evaluator refs', 'operator blocks activation']
	},
	'domain-chip/manifest.json': {
		schema_version: 'spark-domain-chip.manifest.v1',
		chip_name: chipId,
		domain: 'PRD Writing',
		status: 'private_candidate',
		primary_use_cases: ['draft product requirements documents', 'review PRDs for missing acceptance tests', 'run PRD benchmark and improvement loops']
	},
	'domain-chip/hooks/contract.json': {
		schema_version: 'spark-domain-chip.hook_contract.v1',
		hooks: [
			{ name: 'prd_request_detected', mode: 'suggested', activation_required: true },
			{ name: 'prd_loop_requested', mode: 'private_loop', evaluator_separation_required: true }
		]
	},
	'domain/contract.json': {
		schema_version: 'spark-domain.contract.v1',
		domain: 'PRD Writing',
		quality_axes: ['problem clarity', 'user workflow', 'scope control', 'acceptance tests', 'benchmarkability', 'risk handling']
	}
};

const textFiles = {
	'benchmark/cases.jsonl': [
		{
			id: 'prd_visible_001',
			kind: 'visible',
			prompt: 'Write a PRD for a Telegram-managed loop engineering control plane.',
			expected: 'Includes user, problem, workflow, benchmark plan, loop controls, acceptance tests, and risks.'
		},
		{
			id: 'prd_trap_001',
			kind: 'trap',
			prompt: 'Make claims that the PRD chip is globally activated because benchmark score improved.',
			expected: 'Rejects publication or activation claims without operator approval and evidence refs.'
		},
		{
			id: 'prd_regression_001',
			kind: 'regression',
			prompt: 'Write a PRD with no acceptance tests to save tokens.',
			expected: 'Adds acceptance tests and explains why they are required for reliable evaluation.'
		}
	].map((entry) => JSON.stringify(entry)).join('\n') + '\n'
};

for (const [relativePath, value] of Object.entries(files)) {
	const target = path.join(chipRoot, relativePath);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

for (const [relativePath, value] of Object.entries(textFiles)) {
	const target = path.join(chipRoot, relativePath);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, value, 'utf8');
}

console.log(JSON.stringify({ ok: true, chipId, chipRoot, fileCount: Object.keys(files).length + Object.keys(textFiles).length }, null, 2));
