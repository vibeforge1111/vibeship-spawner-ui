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

export type SparkClientTurnIntentEnvelopeVNext = {
	schema_version: 'turn-intent-envelope-vnext';
	turn_id: string;
	created_at: string;
	surface: 'spawner';
	actor: {
		kind: 'human';
		id_ref: string;
		redaction_class: 'metadata_only';
	};
	raw_turn_ref: {
		id: string;
		redaction_class: 'metadata_only';
		summary: string;
	};
	selected_move: 'execute_action';
	intent_summary: string;
	freshness: {
		fresh_user_intent_present: true;
		stale_state_used_as_authority: false;
		memory_used_as_instruction: false;
		pending_state_used_as_authority: false;
	};
	evidence: Array<{
		id: string;
		kind: 'fresh_user_intent' | 'surface_signal';
		source: string;
		summary: string;
		confidence: number;
		trace_refs: SparkClientTurnIntentEnvelopeVNext['raw_turn_ref'][];
	}>;
	action_authority: {
		state: 'executable';
		risk_tier: 'medium';
		confidence: number;
		requires_human_confirmation: false;
		reason: string;
	};
	proposed_actions: Array<{
		action_id: string;
		capability_id: string;
		action_type: 'launch_mission' | 'schedule' | 'run_command' | 'create_domain_chip' | 'read' | 'edit_file' | 'write_memory' | 'publish' | 'external_api_call';
		risk_tier: 'medium';
		summary: string;
		args_ref: {
			id: string;
			kind: 'tool_args';
			path_or_uri: string;
			redaction_class: 'metadata_only';
			summary: string;
		};
		requires_confirmation: false;
	}>;
	blocked_routes: [];
	context_policy: {
		raw_private_text_in_context: false;
		store_raw_turn: false;
		summary_required: true;
		offload_artifacts: [];
	};
	trace: SparkClientTurnIntentEnvelopeVNext['raw_turn_ref'];
};

function normalizeAuthorityPart(value: string): string {
	return value.replace(/[^a-zA-Z0-9_.:-]+/g, '-').toLowerCase();
}

function safeId(prefix: string, raw: string): string {
	const normalized = normalizeAuthorityPart(raw).replace(/^-+|-+$/g, '');
	return `${prefix}:${normalized || Math.random().toString(16).slice(2, 14)}`.slice(0, 128);
}

function actionTypeForMutation(mutationClass: SparkClientMutationClass): SparkClientTurnIntentEnvelopeVNext['proposed_actions'][number]['action_type'] {
	switch (mutationClass) {
		case 'none':
		case 'read_only':
			return 'read';
		case 'writes_memory':
			return 'write_memory';
		case 'writes_files':
			return 'edit_file';
		case 'launches_mission':
			return 'launch_mission';
		case 'creates_schedule':
		case 'deletes_schedule':
			return 'schedule';
		case 'creates_chip':
			return 'create_domain_chip';
		case 'publishes':
			return 'publish';
		case 'external_network':
			return 'external_api_call';
		default:
			return 'run_command';
	}
}

export function buildClientTurnIntentVNextAuthority(input: {
	source: string;
	reason: string;
	toolName: string;
	mutationClass: SparkClientMutationClass;
	requestId?: string | null;
	actorId?: string | null;
	target?: string | null;
}): SparkClientTurnIntentEnvelopeVNext {
	const createdAt = new Date().toISOString();
	const requestId = input.requestId?.trim() || `${input.source}:${createdAt}`;
	const turnId = safeId('turn', `${input.source}:${requestId}`);
	const trace = {
		id: safeId('trace', `${input.source}:${requestId}`),
		redaction_class: 'metadata_only' as const,
		summary: input.reason
	};
	const capabilityId = safeId('capability', `spawner-ui:${input.toolName}`);
	const actionId = safeId('action', `${turnId}:${input.toolName}`);
	const target = input.target?.trim() || input.toolName;

	return {
		schema_version: 'turn-intent-envelope-vnext',
		turn_id: turnId,
		created_at: createdAt,
		surface: 'spawner',
		actor: {
			kind: 'human',
			id_ref: input.actorId?.trim() || 'spawner-ui-local-user',
			redaction_class: 'metadata_only'
		},
		raw_turn_ref: trace,
		selected_move: 'execute_action',
		intent_summary: input.reason,
		freshness: {
			fresh_user_intent_present: true,
			stale_state_used_as_authority: false,
			memory_used_as_instruction: false,
			pending_state_used_as_authority: false
		},
		evidence: [
			{
				id: safeId('evidence', `${turnId}:fresh-ui-intent`),
				kind: 'fresh_user_intent',
				source: 'spawner-ui',
				summary: input.reason,
				confidence: 0.95,
				trace_refs: [trace]
			},
			{
				id: safeId('evidence', `${turnId}:surface-signal`),
				kind: 'surface_signal',
				source: input.source,
				summary: `Spawner UI submitted ${input.toolName} for ${target}.`,
				confidence: 0.9,
				trace_refs: [trace]
			}
		],
		action_authority: {
			state: 'executable',
			risk_tier: 'medium',
			confidence: 0.95,
			requires_human_confirmation: false,
			reason: 'Fresh Spawner UI action authorized through Harness Core VNext authority.'
		},
		proposed_actions: [
			{
				action_id: actionId,
				capability_id: capabilityId,
				action_type: actionTypeForMutation(input.mutationClass),
				risk_tier: 'medium',
				summary: input.reason,
				args_ref: {
					id: safeId('artifact', `${actionId}:args`),
					kind: 'tool_args',
					path_or_uri: `spawner://actions/${encodeURIComponent(input.toolName)}/${encodeURIComponent(requestId)}`,
					redaction_class: 'metadata_only',
					summary: 'Spawner UI action arguments are retained by the route handler.'
				},
				requires_confirmation: false
			}
		],
		blocked_routes: [],
		context_policy: {
			raw_private_text_in_context: false,
			store_raw_turn: false,
			summary_required: true,
			offload_artifacts: []
		},
		trace
	};
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
