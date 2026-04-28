export const DEFAULT_AGENT_WORK_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;

export function positiveIntegerEnv(
	env: NodeJS.ProcessEnv,
	key: string,
	fallbackMs: number
): number {
	const parsed = Number.parseInt(env[key] || '', 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

export function agentWorkTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
	return positiveIntegerEnv(env, 'SPAWNER_AGENT_WORK_TIMEOUT_MS', DEFAULT_AGENT_WORK_TIMEOUT_MS);
}

export function commandTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
	return positiveIntegerEnv(env, 'SPAWNER_COMMAND_TIMEOUT_MS', DEFAULT_COMMAND_TIMEOUT_MS);
}

export function claudeAutoAnalysisTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
	return positiveIntegerEnv(env, 'SPAWNER_CLAUDE_TIMEOUT_MS', agentWorkTimeoutMs(env));
}

export function prdBridgeTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
	return positiveIntegerEnv(env, 'SPAWNER_PRD_BRIDGE_TIMEOUT_MS', agentWorkTimeoutMs(env));
}

export function sparkHarnessTimeoutMs(env: NodeJS.ProcessEnv = process.env): number {
	return positiveIntegerEnv(env, 'SPAWNER_SPARK_HARNESS_TIMEOUT_MS', agentWorkTimeoutMs(env));
}
