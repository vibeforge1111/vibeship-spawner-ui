import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { env as privateEnv } from '$env/dynamic/private';
import {
	boundLedgerRow,
	type GovernorDecisionV1,
	type HarnessCoreBoundLedgerRow,
	type HarnessCoreGovernorConsumerVerification,
	type ToolCallLedgerV1
} from '@spark/harness-core';

export interface SpawnerToolLedgerEmissionInput {
	governorDecision: GovernorDecisionV1;
	verification: HarnessCoreGovernorConsumerVerification;
	ownerSystem: string;
	mutationClass: string;
	requestId?: string | null;
	traceRef?: string | null;
}

export interface SpawnerToolLedgerEmissionResult {
	row: HarnessCoreBoundLedgerRow | null;
	attempted: boolean;
	persisted: boolean;
	strict: boolean;
	skippedReason?: string;
	error?: string;
	stdout?: string;
}

function envValue(name: string): string {
	const privateRecord = privateEnv as Record<string, string | undefined>;
	return String(privateRecord[name] || process.env[name] || '').trim();
}

function isDisabled(value: string): boolean {
	return ['0', 'false', 'no', 'off'].includes(value.toLowerCase());
}

function isEnabled(value: string): boolean {
	return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function canonicalLedgerEnabled(): boolean {
	const explicit = envValue('SPARK_SPAWNER_CANONICAL_LEDGER');
	if (explicit) return !isDisabled(explicit);
	return process.env.NODE_ENV !== 'test' && !process.env.VITEST;
}

export function spawnerCanonicalLedgerStrict(): boolean {
	return isEnabled(envValue('SPARK_SPAWNER_CANONICAL_LEDGER_STRICT'));
}

function builderPython(): string {
	return envValue('SPARK_BUILDER_PYTHON') || 'python';
}

function builderHome(): string {
	return envValue('SPARK_BUILDER_HOME') || path.join(homedir(), '.spark', 'state', 'spark-intelligence');
}

function builderRepoCandidates(): string[] {
	const explicit = envValue('SPARK_BUILDER_REPO');
	return [
		explicit,
		path.resolve(process.cwd(), '..', 'spark-intelligence-builder'),
		path.resolve(process.cwd(), '..', '..', 'spark-intelligence-builder', 'source'),
		path.join(homedir(), '.spark', 'modules', 'spark-intelligence-builder', 'source')
	].filter((candidate): candidate is string => Boolean(candidate));
}

function hasBuilderCli(repo: string): boolean {
	return existsSync(path.join(repo, 'src', 'spark_intelligence', 'cli.py'));
}

function resolveBuilderRepo(): string | null {
	const explicit = envValue('SPARK_BUILDER_REPO');
	if (explicit) return hasBuilderCli(explicit) ? explicit : null;
	for (const candidate of builderRepoCandidates().filter((repo) => repo !== explicit)) {
		if (hasBuilderCli(candidate)) return candidate;
	}
	return null;
}

function ingestTimeoutMs(): number {
	const parsed = Number(envValue('SPARK_SPAWNER_CANONICAL_LEDGER_TIMEOUT_MS'));
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 10_000;
}

function matchingLedger(
	governorDecision: GovernorDecisionV1,
	verification: HarnessCoreGovernorConsumerVerification
): ToolCallLedgerV1 | null {
	if (verification.ledger_id) {
		const byLedgerId = governorDecision.tool_ledgers.find((ledger) => ledger.ledger_id === verification.ledger_id);
		if (byLedgerId) return byLedgerId;
	}
	return (
		governorDecision.tool_ledgers.find(
			(ledger) =>
				(!verification.action_id || ledger.action_id === verification.action_id) &&
				(!verification.capability_id || ledger.capability_id === verification.capability_id) &&
				(!verification.authorization_decision_id || ledger.authorization.decision_id === verification.authorization_decision_id)
		) || null
	);
}

export function buildSpawnerToolLedgerRow(input: SpawnerToolLedgerEmissionInput): HarnessCoreBoundLedgerRow | null {
	const ledger = matchingLedger(input.governorDecision, input.verification);
	if (!ledger) return null;
	return boundLedgerRow({
		ledger,
		verdict: input.verification,
		owner_system: input.ownerSystem,
		mutation_class: input.mutationClass,
		surface: 'spawner',
		request_id: input.requestId || null,
		trace_ref: input.traceRef || null
	});
}

export function emitSpawnerToolLedger(input: SpawnerToolLedgerEmissionInput): SpawnerToolLedgerEmissionResult {
	const row = buildSpawnerToolLedgerRow(input);
	const strict = spawnerCanonicalLedgerStrict();
	if (!row) {
		return { row, attempted: false, persisted: false, strict, skippedReason: 'matching_ledger_missing' };
	}
	if (!canonicalLedgerEnabled()) {
		return { row, attempted: false, persisted: false, strict, skippedReason: 'canonical_ledger_disabled' };
	}
	const builderRepo = resolveBuilderRepo();
	if (!builderRepo) {
		return { row, attempted: false, persisted: false, strict, skippedReason: 'builder_repo_missing' };
	}

	const pythonPath = path.join(builderRepo, 'src');
	const previousPythonPath = process.env.PYTHONPATH || '';
	const childEnv = {
		...process.env,
		PYTHONPATH: previousPythonPath ? `${pythonPath}${path.delimiter}${previousPythonPath}` : pythonPath
	};
	const result = spawnSync(
		builderPython(),
		['-m', 'spark_intelligence.cli', 'gateway', 'ingest-tool-ledger', '-', '--home', builderHome(), '--json'],
		{
			cwd: builderRepo,
			env: childEnv,
			input: JSON.stringify({ row }),
			encoding: 'utf-8',
			timeout: ingestTimeoutMs(),
			windowsHide: true
		}
	);

	if (result.error) {
		return { row, attempted: true, persisted: false, strict, error: result.error.message };
	}
	if (result.status !== 0) {
		return {
			row,
			attempted: true,
			persisted: false,
			strict,
			error: String(result.stderr || result.stdout || `ledger ingest exited with ${result.status}`).trim()
		};
	}
	return { row, attempted: true, persisted: true, strict, stdout: String(result.stdout || '').trim() };
}
