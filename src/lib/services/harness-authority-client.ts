import { browser } from '$app/environment';
import {
	createHarnessCoreActionEnvelopeVNext,
	createHarnessCoreAuthorizedGovernorDecision,
	signHarnessCoreGovernorDecision,
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
	turnId?: string | null;
	requestId?: string | null;
	actorId?: string | null;
	target?: string | null;
	externalNetwork?: boolean;
	publishes?: boolean;
}): SparkClientTurnIntentEnvelopeVNext {
	return createHarnessCoreActionEnvelopeVNext({
		surface: 'spawner',
		ownerSystem: 'spawner-ui',
		source: input.source,
		reason: input.reason,
		toolName: input.toolName,
		mutationClass: input.mutationClass,
		turnId: input.turnId,
		requestId: input.requestId,
		actorIdRef: input.actorId,
		target: input.target,
		externalNetwork: input.externalNetwork,
		publishes: input.publishes,
		confidence: 0.95
	});
}

export function buildClientGovernorDecisionAuthority(input: {
	source: string;
	reason: string;
	toolName: string;
	mutationClass: SparkClientMutationClass;
	turnId?: string | null;
	requestId?: string | null;
	actorId?: string | null;
	target?: string | null;
	externalNetwork?: boolean;
	publishes?: boolean;
}): SparkClientGovernorDecisionV1 {
	if (browser) {
		throw new Error('Browser clients must not mint GovernorDecisionV1 authority. Send the fresh UI action to a server Harness consumer.');
	}
	const envelope = buildClientTurnIntentVNextAuthority(input);
	const decision = createHarnessCoreAuthorizedGovernorDecision({
		envelope,
		tool_name: input.toolName,
		restrictions: {
			network_allowed: input.externalNetwork === true,
			write_allowed: ['writes_files', 'creates_schedule', 'deletes_schedule', 'creates_chip', 'launches_mission'].includes(input.mutationClass),
			publish_allowed: input.publishes === true || input.mutationClass === 'publishes'
		}
	});
	const key = process.env.SPARK_GOVERNOR_HMAC_KEY?.trim();
	if (!key) return decision;
	return signHarnessCoreGovernorDecision(decision, {
		key,
		key_id: process.env.SPARK_GOVERNOR_HMAC_KEY_ID?.trim() || 'local'
	});
}
