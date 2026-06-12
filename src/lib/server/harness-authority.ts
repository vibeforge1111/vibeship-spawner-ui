import {
	actionTypeForHarnessMutation,
	createHarnessCoreActionEnvelopeVNext,
	createHarnessCoreAuthorizedGovernorDecision,
	safeHarnessCoreId,
	signHarnessCoreGovernorDecision,
	verifyHarnessCoreGovernorToolAuthority,
	type GovernorDecisionV1,
	type HarnessCoreActionMutationClass,
	type TurnIntentEnvelopeVNext
} from '@spark/harness-core';
import { env as privateEnv } from '$env/dynamic/private';
import { emitSpawnerToolLedger } from './harness-ledger-ingest';

export type SparkMutationClass = HarnessCoreActionMutationClass;
export type SparkServerTurnIntentEnvelopeVNext = TurnIntentEnvelopeVNext;
export type SparkServerGovernorDecisionV1 = GovernorDecisionV1;

export interface HarnessAuthorityInput {
	authority?: unknown;
	toolName: string;
	ownerSystem: string;
	mutationClass: SparkMutationClass;
	requestId?: string | null;
	publishes?: boolean;
	externalNetwork?: boolean;
}

export interface HarnessAuthorityVerdict {
	allowed: boolean;
	source: 'turn_intent' | 'turn_intent_vnext' | 'governor_decision' | 'machine_origin_policy' | 'missing_authority' | 'unsupported_authority';
	reasonCodes: string[];
	traceId?: string;
	origin?: string;
	governorOutcome?: string;
	ledgerIngest?: {
		attempted: boolean;
		persisted: boolean;
		skippedReason?: string;
		error?: string;
	};
}

export class HarnessAuthorityError extends Error {
	status = 409;
	code = 'harness_authority_blocked';
	verdict: HarnessAuthorityVerdict;

	constructor(message: string, verdict: HarnessAuthorityVerdict) {
		super(message);
		this.name = 'HarnessAuthorityError';
		this.verdict = verdict;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringField(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function stringList(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function hasTool(tools: string[], toolName: string): boolean {
	return tools.includes(toolName) || tools.includes('*') || tools.includes('spawner.*');
}

function actionRequestId(action: Record<string, unknown>): string {
	const argsRef = isRecord(action.args_ref) ? action.args_ref : {};
	const pathOrUri = stringField(argsRef.path_or_uri);
	const encoded = pathOrUri.split('/').pop() || '';
	try {
		return decodeURIComponent(encoded);
	} catch {
		return encoded;
	}
}

function expectedCapabilityId(input: HarnessAuthorityInput): string {
	return safeHarnessCoreId('capability', `${input.ownerSystem}:${input.toolName}`);
}

function governorHmacKey(): string {
	return (privateEnv.SPARK_GOVERNOR_HMAC_KEY || process.env.SPARK_GOVERNOR_HMAC_KEY || '').trim();
}

function governorHmacKeyId(): string {
	return (privateEnv.SPARK_GOVERNOR_HMAC_KEY_ID || process.env.SPARK_GOVERNOR_HMAC_KEY_ID || '').trim() || 'local';
}

function truthyEnv(value: string | undefined): boolean {
	return ['1', 'true', 'yes', 'on'].includes((value || '').trim().toLowerCase());
}

function governorSignatureRequired(): boolean {
	return (
		truthyEnv(privateEnv.SPARK_GOVERNOR_REQUIRE_HMAC || process.env.SPARK_GOVERNOR_REQUIRE_HMAC) ||
		truthyEnv(privateEnv.SPARK_GOVERNOR_HMAC_REQUIRED || process.env.SPARK_GOVERNOR_HMAC_REQUIRED) ||
		process.env.NODE_ENV === 'production'
	);
}

function signGovernorDecisionIfConfigured<T extends GovernorDecisionV1>(decision: T): T {
	const key = governorHmacKey();
	if (!key) return decision;
	return signHarnessCoreGovernorDecision(decision, {
		key,
		key_id: governorHmacKeyId()
	});
}

function turnIntentVerdict(authority: Record<string, unknown>, input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	const directive = isRecord(authority.directive) ? authority.directive : {};
	const selectedIntent = isRecord(authority.selectedIntent) ? authority.selectedIntent : {};
	const runtimeOwnership = isRecord(authority.runtimeOwnership) ? authority.runtimeOwnership : {};
	const toolPolicy = isRecord(authority.toolPolicy) ? authority.toolPolicy : {};
	const executionPolicy = isRecord(authority.executionPolicy) ? authority.executionPolicy : {};
	const allowedTools = stringList(toolPolicy.allowedTools);
	const deniedTools = stringList(toolPolicy.deniedTools);
	const mutationClassesAllowed = stringList(toolPolicy.mutationClassesAllowed);
	const ownerSystem = stringField(selectedIntent.ownerSystem);
	const replyComposerOwner = stringField(runtimeOwnership.replyComposerOwner);
	const reasonCodes: string[] = [];

	if (authority.schema !== 'spark.turn_intent.v1') {
		reasonCodes.push('unsupported_turn_intent_schema');
	}
	if (directive.noExecution === true && input.mutationClass !== 'none' && input.mutationClass !== 'read_only') {
		reasonCodes.push('no_execution_boundary');
	}
	if (directive.noPublish === true && input.publishes) {
		reasonCodes.push('no_publish_boundary');
	}
	if (input.externalNetwork && executionPolicy.canUseExternalNetwork !== true) {
		reasonCodes.push('external_network_not_authorized');
	}
	if (deniedTools.includes(input.toolName)) {
		reasonCodes.push('tool_denied_by_policy');
	}
	if (!hasTool(allowedTools, input.toolName)) {
		reasonCodes.push('tool_not_allowed_by_policy');
	}
	if (!mutationClassesAllowed.includes(input.mutationClass)) {
		reasonCodes.push('mutation_class_not_authorized');
	}
	if (input.ownerSystem !== ownerSystem && input.ownerSystem !== replyComposerOwner) {
		reasonCodes.push('owner_mismatch');
	}

	return {
		allowed: reasonCodes.length === 0,
		source: 'turn_intent',
		reasonCodes,
		traceId: stringField(authority.traceId) || undefined
	};
}

function turnIntentVNextVerdict(authority: Record<string, unknown>, input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	const actionAuthority = isRecord(authority.action_authority) ? authority.action_authority : {};
	const freshness = isRecord(authority.freshness) ? authority.freshness : {};
	const proposedActions = Array.isArray(authority.proposed_actions)
		? authority.proposed_actions.filter(isRecord)
		: [];
	const reasonCodes: string[] = [];
	const selectedMove = stringField(authority.selected_move);
	const authorityState = stringField(actionAuthority.state);
	const expectedActionType = actionTypeForHarnessMutation(input.mutationClass, input.publishes);
	const expectedCapability = expectedCapabilityId(input);
	const matchingAction = proposedActions.find((action) => {
		const capabilityId = stringField(action.capability_id);
		return capabilityId === expectedCapability;
	});

	if (authority.schema_version !== 'turn-intent-envelope-vnext') {
		reasonCodes.push('unsupported_turn_intent_vnext_schema');
	}
	if (!matchingAction) {
		reasonCodes.push('tool_not_allowed_by_policy');
	} else if (stringField(matchingAction.action_type) !== expectedActionType) {
		reasonCodes.push('mutation_class_not_authorized');
	}
	if (matchingAction && input.requestId?.trim() && actionRequestId(matchingAction) !== input.requestId.trim()) {
		reasonCodes.push('request_id_mismatch');
	}
	if (input.mutationClass === 'none' || input.mutationClass === 'read_only') {
		if (authorityState !== 'read_only' && authorityState !== 'executable') {
			reasonCodes.push('read_authority_not_granted');
		}
	} else {
		if (selectedMove !== 'execute_action' || authorityState !== 'executable') {
			reasonCodes.push(authorityState === 'confirmation_required' ? 'confirmation_required' : 'action_not_executable');
		}
	}
	if (freshness.stale_state_used_as_authority === true) {
		reasonCodes.push('stale_state_used_as_authority');
	}
	if (freshness.memory_used_as_instruction === true) {
		reasonCodes.push('memory_used_as_instruction');
	}
	if (freshness.pending_state_used_as_authority === true) {
		reasonCodes.push('pending_state_used_as_authority');
	}
	const freshUserIntentRef = isRecord(freshness.fresh_user_intent_ref) ? freshness.fresh_user_intent_ref : null;
	const evidence = Array.isArray(authority.evidence) ? authority.evidence.filter(isRecord) : [];
	if (freshness.fresh_user_intent_present !== true) {
		reasonCodes.push('fresh_user_intent_missing');
	}
	if (!freshUserIntentRef) {
		reasonCodes.push('fresh_user_intent_ref_missing');
	} else if (stringField(freshUserIntentRef.kind) !== 'fresh_user_intent') {
		reasonCodes.push('fresh_user_intent_ref_not_fresh_user_intent');
	} else if (
		!evidence.some(
			(item) =>
				stringField(item.id) === stringField(freshUserIntentRef.id) &&
				stringField(item.kind) === 'fresh_user_intent' &&
				stringField(item.source) === stringField(freshUserIntentRef.source)
		)
	) {
		reasonCodes.push('fresh_user_intent_evidence_unbound');
	}

	const rawTurnRef = isRecord(authority.raw_turn_ref) ? authority.raw_turn_ref : {};
	return {
		allowed: reasonCodes.length === 0,
		source: 'turn_intent_vnext',
		reasonCodes,
		traceId: stringField(rawTurnRef.id) || stringField(authority.turn_id) || undefined
	};
}

function governorDecisionVerdict(authority: Record<string, unknown>, input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	const envelope = isRecord(authority.envelope) ? authority.envelope : {};
	const reasonCodes: string[] = [];
	const outcome = stringField(authority.outcome);
	const expectedActionType = actionTypeForHarnessMutation(input.mutationClass, input.publishes);
	const governorTurnId = stringField(authority.turn_id);
	const envelopeTurnId = stringField(envelope.turn_id);
	const envelopeVerdict = turnIntentVNextVerdict(envelope, input);
	let ledgerIngest: HarnessAuthorityVerdict['ledgerIngest'];

	if (authority.schema_version !== 'governor-decision-v1') {
		reasonCodes.push('unsupported_governor_decision_schema');
	}
	if (governorTurnId && envelopeTurnId && governorTurnId !== envelopeTurnId) {
		reasonCodes.push('governor_turn_mismatch');
	}
	if (outcome && outcome !== 'execute') {
		reasonCodes.push(`governor_outcome_${outcome}_not_executable`);
		reasonCodes.push('governor_action_not_authorized');
	}
	if (!envelopeVerdict.allowed) {
		reasonCodes.push(...envelopeVerdict.reasonCodes);
	}
	if (authority.schema_version === 'governor-decision-v1') {
		const hmacKey = governorHmacKey();
		const requireSignature = Boolean(hmacKey) || governorSignatureRequired();
		if (requireSignature && !hmacKey) {
			reasonCodes.push('governor_hmac_key_missing');
		}
		const verification = verifyHarnessCoreGovernorToolAuthority({
			governor_decision: authority as unknown as GovernorDecisionV1,
			tool_name: input.toolName,
			owner_system: input.ownerSystem,
			action_type: expectedActionType,
			allow_read_only: input.mutationClass === 'none' || input.mutationClass === 'read_only',
			governor_hmac_key: hmacKey || null,
			governor_hmac_key_id: hmacKey ? governorHmacKeyId() : null,
			require_signature: requireSignature && Boolean(hmacKey)
		});
		reasonCodes.push(...verification.reason_codes);
		if (verification.allowed) {
			const rawTurnRef = isRecord(envelope.raw_turn_ref) ? envelope.raw_turn_ref : {};
			const trace = isRecord(authority.trace) ? authority.trace : {};
			const emission = emitSpawnerToolLedger({
				governorDecision: authority as unknown as GovernorDecisionV1,
				verification,
				ownerSystem: input.ownerSystem,
				mutationClass: input.mutationClass,
				requestId: input.requestId || null,
				traceRef: stringField(rawTurnRef.id) || stringField(trace.id) || stringField(authority.turn_id) || null
			});
			if (emission.strict && !emission.persisted) {
				reasonCodes.push('governor_ledger_ingest_failed');
			}
			ledgerIngest = {
				attempted: emission.attempted,
				persisted: emission.persisted,
				skippedReason: emission.skippedReason,
				error: emission.error
			};
		}
	}

	const rawTurnRef = isRecord(envelope.raw_turn_ref) ? envelope.raw_turn_ref : {};
	const trace = isRecord(authority.trace) ? authority.trace : {};
	return {
		allowed: reasonCodes.length === 0,
		source: 'governor_decision',
		reasonCodes: [...new Set(reasonCodes)],
		traceId: stringField(rawTurnRef.id) || stringField(trace.id) || stringField(authority.turn_id) || undefined,
		governorOutcome: outcome || undefined,
		ledgerIngest
	};
}

function machineOriginVerdict(authority: Record<string, unknown>, input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	const origin = stringField(authority.origin);
	const source = stringField(authority.source);
	const reason = stringField(authority.reason);
	const reasonCodes: string[] = ['legacy_machine_origin_demoted'];

	if (authority.schema !== 'spark.machine_origin_policy.v1') {
		reasonCodes.push('unsupported_machine_origin_schema');
	}
	if (!origin) reasonCodes.push('missing_origin');
	if (!source) reasonCodes.push('missing_source');
	if (!reason) reasonCodes.push('missing_reason');
	if (authority.noExecution === true && input.mutationClass !== 'none' && input.mutationClass !== 'read_only') {
		reasonCodes.push('no_execution_boundary');
	}
	if (authority.noPublish === true && input.publishes) {
		reasonCodes.push('no_publish_boundary');
	}

	return {
		allowed: false,
		source: 'machine_origin_policy',
		reasonCodes,
		origin: origin || undefined
	};
}

function unsupportedAuthorityVerdict(authority: Record<string, unknown>): HarnessAuthorityVerdict {
	return {
		allowed: false,
		source: 'unsupported_authority',
		reasonCodes: ['unsupported_harness_authority_schema'],
		origin: stringField(authority.origin) || undefined
	};
}

export function buildServerTurnIntentVNextAuthority(input: {
	source: string;
	reason: string;
	toolName: string;
	mutationClass: SparkMutationClass;
	turnId?: string | null;
	requestId?: string | null;
	actorKind?: 'human' | 'agent' | 'system';
	actorIdRef?: string | null;
	target?: string | null;
	publishes?: boolean;
	externalNetwork?: boolean;
	requiresHumanConfirmation?: boolean;
	confidence?: number;
}): SparkServerTurnIntentEnvelopeVNext {
	return createHarnessCoreActionEnvelopeVNext({
		surface: 'spawner',
		ownerSystem: 'spawner-ui',
		source: input.source,
		reason: input.reason,
		toolName: input.toolName,
		mutationClass: input.mutationClass,
		turnId: input.turnId,
		requestId: input.requestId,
		actorKind: input.actorKind ?? 'system',
		actorIdRef: input.actorIdRef ?? 'spawner-ui',
		target: input.target,
		publishes: input.publishes,
		externalNetwork: input.externalNetwork,
		requiresHumanConfirmation: input.requiresHumanConfirmation,
		confidence: input.confidence ?? 0.9
	});
}

export function buildServerGovernorDecisionAuthority(input: {
	source: string;
	reason: string;
	toolName: string;
	mutationClass: SparkMutationClass;
	turnId?: string | null;
	requestId?: string | null;
	actorKind?: 'human' | 'agent' | 'system';
	actorIdRef?: string | null;
	target?: string | null;
	publishes?: boolean;
	externalNetwork?: boolean;
	requiresHumanConfirmation?: boolean;
	confidence?: number;
	replyInstruction?: string;
}): SparkServerGovernorDecisionV1 {
	// Native Governor authority represents a final approved surface action; bare VNext remains non-final evidence.
	const envelope = buildServerTurnIntentVNextAuthority({
		...input,
		actorKind: 'human'
	});
	return signGovernorDecisionIfConfigured(createHarnessCoreAuthorizedGovernorDecision({
		envelope,
		tool_name: input.toolName,
		restrictions: {
			network_allowed: input.externalNetwork === true,
			write_allowed: ['writes_files', 'creates_schedule', 'deletes_schedule', 'creates_chip', 'launches_mission'].includes(input.mutationClass),
			publish_allowed: input.publishes === true
		},
		reply_instruction: input.replyInstruction
	}));
}

export function assertHarnessAuthority(input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	if (!isRecord(input.authority)) {
		const verdict: HarnessAuthorityVerdict = {
			allowed: false,
			source: 'missing_authority',
			reasonCodes: ['missing_harness_authority']
		};
		throw new HarnessAuthorityError('Execution requires Harness Core authority.', verdict);
	}

	const authority = input.authority;
	let verdict: HarnessAuthorityVerdict;
	if (authority.schema === 'spark.turn_intent.v1') {
		verdict = turnIntentVerdict(authority, input);
	} else if (authority.schema_version === 'governor-decision-v1') {
		verdict = governorDecisionVerdict(authority, input);
	} else if (authority.schema_version === 'turn-intent-envelope-vnext') {
		verdict = turnIntentVNextVerdict(authority, input);
	} else if (authority.schema === 'spark.machine_origin_policy.v1') {
		verdict = machineOriginVerdict(authority, input);
	} else {
		verdict = unsupportedAuthorityVerdict(authority);
	}

	if (!verdict.allowed) {
		throw new HarnessAuthorityError('Execution authority blocked this request.', verdict);
	}
	return verdict;
}

export function assertNativeGovernorHarnessAuthority(input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	if (isRecord(input.authority) && input.authority.schema_version === 'turn-intent-envelope-vnext') {
		const rawTurnRef = isRecord(input.authority.raw_turn_ref) ? input.authority.raw_turn_ref : {};
		const envelopeVerdict = turnIntentVNextVerdict(input.authority, input);
		throw new HarnessAuthorityError(`${input.toolName} requires native GovernorDecisionV1 authority.`, {
			allowed: false,
			source: 'turn_intent_vnext',
			reasonCodes: [...new Set(['native_governor_required', ...envelopeVerdict.reasonCodes])],
			traceId: stringField(rawTurnRef.id) || stringField(input.authority.turn_id) || envelopeVerdict.traceId || undefined
		});
	}
	const verdict = assertHarnessAuthority(input);
	if (verdict.source !== 'governor_decision') {
		throw new HarnessAuthorityError(`${input.toolName} requires native GovernorDecisionV1 authority.`, {
			allowed: false,
			source: verdict.source,
			reasonCodes: ['native_governor_required'],
			traceId: verdict.traceId,
			origin: verdict.origin,
			governorOutcome: verdict.governorOutcome
		});
	}
	return verdict;
}

export function assertNativeVNextHarnessAuthority(input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	const verdict = assertHarnessAuthority(input);
	if (verdict.source !== 'turn_intent_vnext') {
		throw new HarnessAuthorityError(`${input.toolName} requires native TurnIntentEnvelopeVNext authority.`, {
			allowed: false,
			source: verdict.source,
			reasonCodes: ['native_vnext_required'],
			traceId: verdict.traceId,
			origin: verdict.origin
		});
	}
	return verdict;
}

export function resolveExecutionAuthority(...candidates: unknown[]): unknown {
	for (const candidate of candidates) {
		if (isRecord(candidate) && (candidate.schema || candidate.schema_version)) return candidate;
	}
	return null;
}
