import type {
	WatchdogAuthorityGateRow,
	WatchdogEvidenceRef,
	WatchdogOpenBlocker,
	WatchdogRowStatus
} from '$lib/services/harness-watchdog';
import {
	HarnessAuthorityError,
	assertNativeGovernorHarnessAuthority,
	resolveExecutionAuthority,
	type HarnessAuthorityVerdict,
	type SparkMutationClass
} from './harness-authority';
import {
	artifactTimestamp,
	evidenceRef,
	isRecord,
	makeOpenBlocker,
	makeWatchdogRow,
	mergeEvidenceRefs,
	readWatchdogJsonArtifact,
	resolveWatchdogCorrelation,
	safeRequestFileSegment,
	stringField,
	type WatchdogCorrelation
} from './harness-watchdog-state';

const DISPATCH_TOOL_NAME = 'spawner.dispatch';
const DISPATCH_OWNER_SYSTEM = 'spawner-ui';
const DISPATCH_MUTATION_CLASS: SparkMutationClass = 'launches_mission';
const DISPATCH_CAPABILITY_ID = 'capability:spawner-ui:spawner.dispatch';

type AuthorityGate = WatchdogAuthorityGateRow['gate'];

export interface CollectHarnessWatchdogAuthorityOptions {
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	stateDir?: string;
	checkedAt?: string;
}

export interface HarnessWatchdogAuthoritySnapshot {
	requestId: string | null;
	missionId: string | null;
	traceRef: string | null;
	checkedAt: string;
	rows: WatchdogAuthorityGateRow[];
	openBlockers: WatchdogOpenBlocker[];
	evidenceRefs: WatchdogEvidenceRef[];
}

interface AuthorityEvidence {
	authority: Record<string, unknown> | null;
	residueAuthority: Record<string, unknown> | null;
	source: string;
	evidenceRef: string;
}

function nestedAuthorityCandidates(artifact: Record<string, unknown> | null): unknown[] {
	if (!artifact) return [];
	const relay = isRecord(artifact.relay) ? artifact.relay : {};
	const metadata = isRecord(artifact.metadata) ? artifact.metadata : {};
	const autoDispatch = isRecord(artifact.autoDispatch) ? artifact.autoDispatch : {};
	return [
		artifact.executionAuthority,
		artifact.execution_authority,
		relay.executionAuthority,
		relay.execution_authority,
		metadata.executionAuthority,
		metadata.execution_authority,
		autoDispatch.executionAuthority,
		autoDispatch.execution_authority
	];
}

function selectedAuthority(input: {
	pendingRequest: Record<string, unknown> | null;
	lastCanvasLoad: Record<string, unknown> | null;
	pendingLoad: Record<string, unknown> | null;
	prdResult: Record<string, unknown> | null;
}): AuthorityEvidence {
	const candidates: Array<{ source: string; ref: string; values: unknown[] }> = [
		{ source: 'spawner-state', ref: 'state.pending-request', values: nestedAuthorityCandidates(input.pendingRequest) },
		{ source: 'prd-bridge', ref: 'state.last-canvas-load', values: nestedAuthorityCandidates(input.lastCanvasLoad) },
		{ source: 'prd-bridge', ref: 'state.pending-load', values: nestedAuthorityCandidates(input.pendingLoad) },
		{ source: 'prd-bridge', ref: 'state.prd-result', values: nestedAuthorityCandidates(input.prdResult) }
	];

	for (const candidate of candidates) {
		const authority = resolveExecutionAuthority(...candidate.values);
		if (isRecord(authority)) {
			return {
				authority: null,
				residueAuthority: authority,
				source: candidate.source,
				evidenceRef: candidate.ref
			};
		}
	}

	return {
		authority: null,
		residueAuthority: null,
		source: 'harness-governor',
		evidenceRef: 'authority.execution'
	};
}

function makeGateRow(input: {
	id: string;
	label: string;
	gate: AuthorityGate;
	status: WatchdogRowStatus;
	severity?: WatchdogAuthorityGateRow['severity'];
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef: string | null;
	correlation: WatchdogCorrelation;
	details?: string[];
}): WatchdogAuthorityGateRow {
	return {
		...makeWatchdogRow(input),
		gate: input.gate
	};
}

function gateBlocker(row: WatchdogAuthorityGateRow): WatchdogOpenBlocker | null {
	if (row.severity === 'healthy') return null;
	if (!['blocked', 'degraded', 'stale', 'error', 'empty'].includes(row.severity)) return null;
	return makeOpenBlocker({
		id: `blocker.${row.id}`,
		status: row.severity as WatchdogOpenBlocker['status'],
		source: row.source,
		checkedAt: row.checkedAt,
		summary: row.summary,
		evidenceRef: row.evidenceRef,
		correlation: {
			requestId: row.requestId ?? null,
			missionId: row.missionId ?? null,
			traceRef: row.traceRef ?? null
		},
		details: row.details
	});
}

function evidenceDetails(verdict: HarnessAuthorityVerdict | null): string[] {
	if (!verdict) return [];
	const details = [`authoritySource: ${verdict.source}`];
	if (verdict.governorOutcome) details.push(`governorOutcome: ${verdict.governorOutcome}`);
	if (verdict.reasonCodes.length) details.push(`reasonCodes: ${verdict.reasonCodes.slice(0, 8).join(', ')}`);
	return details;
}

function governorStatus(
	authority: Record<string, unknown> | null,
	verdict: HarnessAuthorityVerdict | null,
	residueAuthority: Record<string, unknown> | null
): {
	status: WatchdogRowStatus;
	summary: string;
	details: string[];
} {
	if (residueAuthority) {
		return {
			status: 'stale',
			summary: 'Stored executionAuthority residue is present but cannot authorize high-agency dispatch.',
			details: ['stored_authority_residue', 'Fresh Harness/Governor authority is required at dispatch time.']
		};
	}
	if (!authority) {
		return {
			status: 'missing',
			summary: 'Native GovernorDecisionV1 evidence is absent for high-agency dispatch.',
			details: ['Route wording, bare mission IDs, pending state, and local regex are evidence only.']
		};
	}
	if (authority.schema === 'spark.machine_origin_policy.v1') {
		return {
			status: 'machine-policy-origin',
			summary: 'Legacy machine-origin policy evidence is present and cannot authorize high-agency execution.',
			details: ['Machine-origin evidence is displayed as a blocker, not treated as launch authority.']
		};
	}
	if (authority.schema_version === 'turn-intent-envelope-vnext') {
		return {
			status: 'degraded',
			summary: 'Bare TurnIntentEnvelopeVNext evidence is present, but native GovernorDecisionV1 is required.',
			details: ['native_governor_required']
		};
	}
	if (verdict?.allowed) {
		return {
			status: 'approved',
			summary: 'Native GovernorDecisionV1 evidence is present and verifier-valid for dispatch.',
			details: evidenceDetails(verdict)
		};
	}
	const outcome = stringField(authority.outcome);
	if (outcome === 'interrupted' || outcome === 'cancelled') {
		return {
			status: 'interrupted',
			summary: 'Governor evidence reports interrupted execution.',
			details: evidenceDetails(verdict)
		};
	}
	if (outcome && outcome !== 'execute') {
		return {
			status: 'denied',
			summary: `Governor evidence reports ${outcome} instead of execute.`,
			details: evidenceDetails(verdict)
		};
	}
	return {
		status: 'degraded',
		summary: 'Governor evidence is present but failed native dispatch verification.',
		details: evidenceDetails(verdict)
	};
}

function authorityEnvelope(authority: Record<string, unknown> | null): Record<string, unknown> | null {
	if (!authority) return null;
	if (authority.schema_version === 'governor-decision-v1') {
		return isRecord(authority.envelope) ? authority.envelope : null;
	}
	if (authority.schema_version === 'turn-intent-envelope-vnext') return authority;
	return null;
}

function proposedActions(envelope: Record<string, unknown> | null): Record<string, unknown>[] {
	return Array.isArray(envelope?.proposed_actions) ? envelope.proposed_actions.filter(isRecord) : [];
}

function authorizations(authority: Record<string, unknown> | null): Record<string, unknown>[] {
	return Array.isArray(authority?.authorizations) ? authority.authorizations.filter(isRecord) : [];
}

function dispatchCapabilityEvidence(authority: Record<string, unknown> | null): {
	matchingCapability: Record<string, unknown> | null;
	matchingAuthorization: Record<string, unknown> | null;
	anyCapabilityId: string | null;
} {
	const envelope = authorityEnvelope(authority);
	const actions = proposedActions(envelope);
	const authz = authorizations(authority);
	const matchingCapability = actions.find((action) => stringField(action.capability_id) === DISPATCH_CAPABILITY_ID) ?? null;
	const matchingAuthorization = authz.find((item) => stringField(item.capability_id) === DISPATCH_CAPABILITY_ID) ?? null;
	const anyCapabilityId = stringField(matchingCapability?.capability_id) || stringField(actions[0]?.capability_id);
	return { matchingCapability, matchingAuthorization, anyCapabilityId };
}

function capabilityRow(input: {
	authority: Record<string, unknown> | null;
	source: string;
	checkedAt: string;
	evidenceRef: string;
	correlation: WatchdogCorrelation;
}): WatchdogAuthorityGateRow {
	const { matchingCapability, matchingAuthorization } = dispatchCapabilityEvidence(input.authority);
	const verdict = stringField(matchingAuthorization?.verdict);
	const status: WatchdogRowStatus = verdict === 'deny' ? 'denied' : matchingCapability || verdict === 'allow' ? 'approved' : 'missing';
	const severity = status === 'approved' ? 'healthy' : 'blocked';
	return makeGateRow({
		id: 'authority.capability',
		label: 'Capability gate',
		gate: 'capability',
		status,
		severity,
		source: input.source,
		checkedAt: input.checkedAt,
		summary:
			status === 'approved'
				? 'Dispatch capability evidence is bound to capability:spawner-ui:spawner.dispatch.'
				: status === 'denied'
					? 'Dispatch capability authorization is denied.'
					: 'Dispatch capability evidence is missing.',
		evidenceRef: input.evidenceRef,
		correlation: input.correlation,
		details: matchingAuthorization ? [`authorizationVerdict: ${verdict || 'unknown'}`] : undefined
	});
}

function ownerRow(input: {
	authority: Record<string, unknown> | null;
	source: string;
	checkedAt: string;
	evidenceRef: string;
	correlation: WatchdogCorrelation;
}): WatchdogAuthorityGateRow {
	const { anyCapabilityId } = dispatchCapabilityEvidence(input.authority);
	const status: WatchdogRowStatus = !anyCapabilityId
		? 'missing'
		: anyCapabilityId.startsWith('capability:spawner-ui:')
			? 'approved'
			: 'denied';
	return makeGateRow({
		id: 'authority.owner',
		label: 'Owner gate',
		gate: 'owner',
		status,
		severity: status === 'approved' ? 'healthy' : 'blocked',
		source: input.source,
		checkedAt: input.checkedAt,
		summary:
			status === 'approved'
				? 'Capability ownership is scoped to spawner-ui.'
				: status === 'denied'
					? 'Capability ownership does not match spawner-ui.'
					: 'Capability ownership evidence is missing.',
		evidenceRef: input.evidenceRef,
		correlation: input.correlation,
		details: anyCapabilityId ? ['Capability id is metadata only.'] : undefined
	});
}

function freshnessRow(input: {
	authority: Record<string, unknown> | null;
	source: string;
	checkedAt: string;
	evidenceRef: string;
	correlation: WatchdogCorrelation;
}): WatchdogAuthorityGateRow {
	const envelope = authorityEnvelope(input.authority);
	const freshness = isRecord(envelope?.freshness) ? envelope.freshness : null;
	if (!freshness) {
		return makeGateRow({
			id: 'authority.freshness',
			label: 'Freshness gate',
			gate: 'freshness',
			status: 'missing',
			severity: 'blocked',
			source: input.source,
			checkedAt: input.checkedAt,
			summary: 'Fresh user intent evidence is missing.',
			evidenceRef: input.evidenceRef,
			correlation: input.correlation
		});
	}
	const staleFlags = [
		freshness.stale_state_used_as_authority === true ? 'stale_state_used_as_authority' : null,
		freshness.memory_used_as_instruction === true ? 'memory_used_as_instruction' : null,
		freshness.pending_state_used_as_authority === true ? 'pending_state_used_as_authority' : null
	].filter((value): value is string => Boolean(value));
	const freshRef = isRecord(freshness.fresh_user_intent_ref) ? freshness.fresh_user_intent_ref : null;
	const approved = freshness.fresh_user_intent_present === true && freshRef && staleFlags.length === 0;
	const status: WatchdogRowStatus = staleFlags.length > 0 ? 'stale' : approved ? 'approved' : 'missing';
	return makeGateRow({
		id: 'authority.freshness',
		label: 'Freshness gate',
		gate: 'freshness',
		status,
		severity: status === 'approved' ? 'healthy' : status === 'stale' ? 'stale' : 'blocked',
		source: input.source,
		checkedAt: input.checkedAt,
		summary:
			status === 'approved'
				? 'Fresh user intent reference is present and not replaced by stale state.'
				: status === 'stale'
					? 'Freshness evidence used stale, pending, or memory state as authority.'
					: 'Fresh user intent reference is missing.',
		evidenceRef: input.evidenceRef,
		correlation: input.correlation,
		details: staleFlags.length ? staleFlags : undefined
	});
}

function riskRow(input: {
	authority: Record<string, unknown> | null;
	source: string;
	checkedAt: string;
	evidenceRef: string;
	correlation: WatchdogCorrelation;
}): WatchdogAuthorityGateRow {
	const envelope = authorityEnvelope(input.authority);
	const actionAuthority = isRecord(envelope?.action_authority) ? envelope.action_authority : null;
	const restrictions = isRecord(input.authority?.restrictions) ? input.authority.restrictions : null;
	if (!actionAuthority) {
		return makeGateRow({
			id: 'authority.risk',
			label: 'Risk gate',
			gate: 'risk',
			status: 'missing',
			severity: 'blocked',
			source: input.source,
			checkedAt: input.checkedAt,
			summary: 'Risk and action-authority evidence is missing.',
			evidenceRef: input.evidenceRef,
			correlation: input.correlation
		});
	}
	const requiresConfirmation = actionAuthority.requires_human_confirmation === true;
	const state = stringField(actionAuthority.state);
	const blocked = requiresConfirmation || state === 'confirmation_required' || state === 'blocked';
	const degraded = !stringField(actionAuthority.risk_tier);
	const status: WatchdogRowStatus = blocked ? 'denied' : degraded ? 'degraded' : 'approved';
	return makeGateRow({
		id: 'authority.risk',
		label: 'Risk gate',
		gate: 'risk',
		status,
		severity: status === 'approved' ? 'healthy' : status === 'degraded' ? 'degraded' : 'blocked',
		source: input.source,
		checkedAt: input.checkedAt,
		summary:
			status === 'approved'
				? 'Risk evidence is executable and does not require extra confirmation.'
				: status === 'degraded'
					? 'Risk evidence is present but missing risk tier metadata.'
					: 'Risk evidence requires confirmation or reports a blocked action state.',
		evidenceRef: input.evidenceRef,
		correlation: input.correlation,
		details: [
			`state: ${state || 'unknown'}`,
			`riskTier: ${stringField(actionAuthority.risk_tier) || 'unknown'}`,
			`requiresHumanConfirmation: ${requiresConfirmation}`,
			`publishAllowed: ${restrictions?.publish_allowed === true}`
		]
	});
}

function machinePolicyRow(input: {
	authority: Record<string, unknown> | null;
	residueAuthority: Record<string, unknown> | null;
	source: string;
	checkedAt: string;
	evidenceRef: string;
	correlation: WatchdogCorrelation;
}): WatchdogAuthorityGateRow {
	const machineOrigin =
		input.authority?.schema === 'spark.machine_origin_policy.v1' ||
		input.residueAuthority?.schema === 'spark.machine_origin_policy.v1';
	return makeGateRow({
		id: 'authority.machine_policy',
		label: 'Machine policy gate',
		gate: 'machine_policy',
		status: machineOrigin ? 'machine-policy-origin' : 'approved',
		severity: machineOrigin ? 'blocked' : 'healthy',
		source: input.source,
		checkedAt: input.checkedAt,
		summary: machineOrigin
			? 'Legacy machine-origin policy is present and demoted to evidence-only.'
			: 'No selected machine-origin policy evidence is being treated as execution authority.',
		evidenceRef: input.evidenceRef,
		correlation: input.correlation
	});
}

function classifyGovernor(
	authority: Record<string, unknown> | null,
	correlation: WatchdogCorrelation
): HarnessAuthorityVerdict | null {
	if (!authority) return null;
	try {
		return assertNativeGovernorHarnessAuthority({
			authority,
			toolName: DISPATCH_TOOL_NAME,
			ownerSystem: DISPATCH_OWNER_SYSTEM,
			mutationClass: DISPATCH_MUTATION_CLASS,
			requestId: correlation.requestId
		});
	} catch (error) {
		if (error instanceof HarnessAuthorityError) return error.verdict;
		return {
			allowed: false,
			source: 'unsupported_authority',
			reasonCodes: ['authority_verifier_error']
		};
	}
}

export async function collectHarnessWatchdogAuthority(
	options: CollectHarnessWatchdogAuthorityOptions = {}
): Promise<HarnessWatchdogAuthoritySnapshot> {
	const checkedAt = options.checkedAt ?? new Date().toISOString();
	const pendingRequest = await readWatchdogJsonArtifact({
		stateDir: options.stateDir,
		fileName: 'pending-request.json',
		id: 'state.pending-request',
		label: 'pending-request.json',
		source: 'spawner-state',
		checkedAt
	});
	const lastCanvasLoad = await readWatchdogJsonArtifact({
		stateDir: options.stateDir,
		fileName: 'last-canvas-load.json',
		id: 'state.last-canvas-load',
		label: 'last-canvas-load.json',
		source: 'prd-bridge',
		checkedAt
	});
	const pendingLoad = await readWatchdogJsonArtifact({
		stateDir: options.stateDir,
		fileName: 'pending-load.json',
		id: 'state.pending-load',
		label: 'pending-load.json',
		source: 'prd-bridge',
		checkedAt
	});

	const correlation = resolveWatchdogCorrelation({
		requestId: options.requestId,
		missionId: options.missionId,
		traceRef: options.traceRef,
		pendingRequest: pendingRequest.value,
		lastCanvasLoad: lastCanvasLoad.value
	});
	const prdResult = correlation.requestId
		? await readWatchdogJsonArtifact({
				stateDir: options.stateDir,
				fileName: `results/${safeRequestFileSegment(correlation.requestId)}.json`,
				id: 'state.prd-result',
				label: 'results/<requestId>.json',
				source: 'prd-bridge',
				checkedAt
			})
		: null;
	const authorityEvidence = selectedAuthority({
		pendingRequest: pendingRequest.value,
		lastCanvasLoad: lastCanvasLoad.value,
		pendingLoad: pendingLoad.value,
		prdResult: prdResult?.value ?? null
	});
	const authorityRef = evidenceRef({
		id: 'authority.execution',
		source: authorityEvidence.source,
		label: authorityEvidence.residueAuthority
			? 'stored executionAuthority residue'
			: authorityEvidence.authority
				? 'executionAuthority metadata'
				: 'missing executionAuthority evidence',
		kind: 'authority_snapshot',
		redaction: authorityEvidence.authority || authorityEvidence.residueAuthority ? 'metadata_only' : 'not_available',
		checkedAt
	});
	const evidenceRefs = mergeEvidenceRefs(
		[pendingRequest.evidenceRef, lastCanvasLoad.evidenceRef, pendingLoad.evidenceRef, authorityRef],
		prdResult ? [prdResult.evidenceRef] : []
	);
	const source = authorityEvidence.authority || authorityEvidence.residueAuthority ? authorityEvidence.source : 'harness-governor';
	const selectedRef = authorityEvidence.authority || authorityEvidence.residueAuthority ? authorityEvidence.evidenceRef : authorityRef.id;
	const verdict = classifyGovernor(authorityEvidence.authority, correlation);
	const governor = governorStatus(authorityEvidence.authority, verdict, authorityEvidence.residueAuthority);

	const rows: WatchdogAuthorityGateRow[] = [
		makeGateRow({
			id: 'authority.governor',
			label: 'Governor gate',
			gate: 'governor',
			status: governor.status,
			severity: governor.status === 'approved' ? 'healthy' : governor.status === 'stale' ? 'stale' : 'blocked',
			source,
			checkedAt,
			summary: governor.summary,
			evidenceRef: selectedRef,
			correlation,
			details: governor.details
		}),
		capabilityRow({ authority: authorityEvidence.authority, source, checkedAt, evidenceRef: selectedRef, correlation }),
		ownerRow({ authority: authorityEvidence.authority, source, checkedAt, evidenceRef: selectedRef, correlation }),
		freshnessRow({ authority: authorityEvidence.authority, source, checkedAt, evidenceRef: selectedRef, correlation }),
		riskRow({ authority: authorityEvidence.authority, source, checkedAt, evidenceRef: selectedRef, correlation }),
		machinePolicyRow({
			authority: authorityEvidence.authority,
			residueAuthority: authorityEvidence.residueAuthority,
			source,
			checkedAt,
			evidenceRef: selectedRef,
			correlation
		})
	];

	const timestamp = artifactTimestamp(pendingLoad.value) || artifactTimestamp(lastCanvasLoad.value);
	if (!timestamp) {
		rows.push(
			makeGateRow({
				id: 'authority.dispatch_freshness',
				label: 'Dispatch evidence time',
				gate: 'freshness',
				status: 'degraded',
				severity: 'degraded',
				source: 'prd-bridge',
				checkedAt,
				summary: 'Dispatch authority evidence has no timestamp to prove freshness.',
				evidenceRef: selectedRef,
				correlation
			})
		);
	}

	const openBlockers = rows
		.map(gateBlocker)
		.filter((blocker): blocker is WatchdogOpenBlocker => Boolean(blocker));

	return {
		...correlation,
		checkedAt,
		rows,
		openBlockers,
		evidenceRefs
	};
}
