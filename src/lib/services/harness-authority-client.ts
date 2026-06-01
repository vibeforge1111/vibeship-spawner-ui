export type SparkClientMutationClass =
	| 'none'
	| 'read_only'
	| 'writes_memory'
	| 'writes_files'
	| 'launches_mission'
	| 'controls_mission'
	| 'creates_schedule'
	| 'deletes_schedule'
	| 'creates_chip'
	| 'publishes'
	| 'external_network';

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
