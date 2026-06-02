import {
	createHarnessCoreActionEnvelopeVNext,
	createHarnessCoreAuthorizedGovernorDecision,
	type GovernorDecisionV1,
	type HarnessCoreActionMutationClass,
	type TurnIntentEnvelopeVNext
} from '@spark/harness-core';

export type SparkClientMutationClass = HarnessCoreActionMutationClass;

export type SparkClientTurnIntentEnvelopeVNext = TurnIntentEnvelopeVNext;
export type SparkClientGovernorDecisionV1 = GovernorDecisionV1;

export function buildClientTurnIntentVNextAuthority(input: {
	source: string;
	reason: string;
	toolName: string;
	mutationClass: SparkClientMutationClass;
	requestId?: string | null;
	actorId?: string | null;
	target?: string | null;
}): SparkClientTurnIntentEnvelopeVNext {
	return createHarnessCoreActionEnvelopeVNext({
		surface: 'spawner',
		ownerSystem: 'spawner-ui',
		source: input.source,
		reason: input.reason,
		toolName: input.toolName,
		mutationClass: input.mutationClass,
		requestId: input.requestId,
		actorIdRef: input.actorId,
		target: input.target,
		confidence: 0.95
	});
}

export function buildClientGovernorDecisionAuthority(input: {
	source: string;
	reason: string;
	toolName: string;
	mutationClass: SparkClientMutationClass;
	requestId?: string | null;
	actorId?: string | null;
	target?: string | null;
}): SparkClientGovernorDecisionV1 {
	const envelope = buildClientTurnIntentVNextAuthority(input);
	return createHarnessCoreAuthorizedGovernorDecision({
		envelope,
		tool_name: input.toolName,
		restrictions: {
			network_allowed: false,
			write_allowed: ['writes_files', 'creates_schedule', 'deletes_schedule', 'creates_chip', 'launches_mission'].includes(input.mutationClass),
			publish_allowed: input.mutationClass === 'publishes'
		}
	});
}
