import {
	createHarnessCoreActionEnvelopeVNext,
	type HarnessCoreActionMutationClass,
	type TurnIntentEnvelopeVNext
} from '@spark/harness-core';

export type SparkClientMutationClass = HarnessCoreActionMutationClass;

export type SparkClientMachineOriginPolicyV1 = {
	schema: 'spark.machine_origin_policy.v1';
	origin: string;
	source: string;
	reason: string;
	allowedTools: string[];
	mutationClassesAllowed: SparkClientMutationClass[];
	networkPolicy: 'none' | 'local_only' | 'external_allowed';
	noExecution?: boolean;
	noPublish?: boolean;
};

export type SparkClientTurnIntentEnvelopeVNext = TurnIntentEnvelopeVNext;

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

export function buildClientMachineOriginPolicy(input: {
	origin: string;
	source: string;
	reason: string;
	allowedTools: string[];
	mutationClassesAllowed: SparkClientMutationClass[];
	networkPolicy?: SparkClientMachineOriginPolicyV1['networkPolicy'];
}): SparkClientMachineOriginPolicyV1 {
	return {
		schema: 'spark.machine_origin_policy.v1',
		origin: input.origin,
		source: input.source,
		reason: input.reason,
		allowedTools: input.allowedTools,
		mutationClassesAllowed: input.mutationClassesAllowed,
		networkPolicy: input.networkPolicy || 'local_only'
	};
}
