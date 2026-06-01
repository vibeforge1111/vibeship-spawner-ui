export type SparkMutationClass =
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

export interface SparkMachineOriginPolicyV1 {
	schema: 'spark.machine_origin_policy.v1';
	origin: string;
	source: string;
	reason: string;
	allowedTools: string[];
	mutationClassesAllowed: SparkMutationClass[];
	networkPolicy?: 'none' | 'local_only' | 'external_allowed';
	noExecution?: boolean;
	noPublish?: boolean;
}

export interface HarnessAuthorityInput {
	authority?: unknown;
	toolName: string;
	ownerSystem: string;
	mutationClass: SparkMutationClass;
	publishes?: boolean;
	externalNetwork?: boolean;
}

export interface HarnessAuthorityVerdict {
	allowed: boolean;
	source: 'turn_intent' | 'machine_origin_policy';
	reasonCodes: string[];
	traceId?: string;
	origin?: string;
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

function machineOriginVerdict(authority: Record<string, unknown>, input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	const allowedTools = stringList(authority.allowedTools);
	const mutationClassesAllowed = stringList(authority.mutationClassesAllowed);
	const origin = stringField(authority.origin);
	const source = stringField(authority.source);
	const reason = stringField(authority.reason);
	const networkPolicy = stringField(authority.networkPolicy) || 'local_only';
	const reasonCodes: string[] = [];

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
	if (input.externalNetwork && networkPolicy !== 'external_allowed') {
		reasonCodes.push('external_network_not_authorized');
	}
	if (!hasTool(allowedTools, input.toolName)) {
		reasonCodes.push('tool_not_allowed_by_policy');
	}
	if (!mutationClassesAllowed.includes(input.mutationClass)) {
		reasonCodes.push('mutation_class_not_authorized');
	}

	return {
		allowed: reasonCodes.length === 0,
		source: 'machine_origin_policy',
		reasonCodes,
		origin: origin || undefined
	};
}

export function buildMachineOriginPolicy(input: {
	origin: string;
	source: string;
	reason: string;
	allowedTools?: string[];
	mutationClassesAllowed?: SparkMutationClass[];
	networkPolicy?: SparkMachineOriginPolicyV1['networkPolicy'];
}): SparkMachineOriginPolicyV1 {
	return {
		schema: 'spark.machine_origin_policy.v1',
		origin: input.origin,
		source: input.source,
		reason: input.reason,
		allowedTools: input.allowedTools || ['spawner.dispatch'],
		mutationClassesAllowed: input.mutationClassesAllowed || ['launches_mission'],
		networkPolicy: input.networkPolicy || 'local_only'
	};
}

export function assertHarnessAuthority(input: HarnessAuthorityInput): HarnessAuthorityVerdict {
	if (!isRecord(input.authority)) {
		const verdict: HarnessAuthorityVerdict = {
			allowed: false,
			source: 'machine_origin_policy',
			reasonCodes: ['missing_harness_authority']
		};
		throw new HarnessAuthorityError('Execution requires TurnIntent authority or an explicit machine-origin policy.', verdict);
	}

	const verdict =
		input.authority.schema === 'spark.turn_intent.v1'
			? turnIntentVerdict(input.authority, input)
			: machineOriginVerdict(input.authority, input);

	if (!verdict.allowed) {
		throw new HarnessAuthorityError('Execution authority blocked this request.', verdict);
	}
	return verdict;
}

export function resolveExecutionAuthority(...candidates: unknown[]): unknown {
	for (const candidate of candidates) {
		if (isRecord(candidate) && candidate.schema) return candidate;
	}
	return null;
}
