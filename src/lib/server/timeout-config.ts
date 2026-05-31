export const DEFAULT_AGENT_WORK_TIMEOUT_MS = 30 * 60 * 1000;
export const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;

export function positiveIntegerEnv(
	env: NodeJS.ProcessEnv,
	key: string,
	fallbackMs: number
): number {
	// Reject any value that isn't strictly a positive integer. Number.parseInt
	// is lenient — it parses the leading digits and silently ignores any
	// trailing characters, so common operator typos like "5m", "30s", "1h",
	// "15min", "2hr", or "5 minutes" parse to 5, 30, 1, 15, 2, 5 millisecond
	// timeouts and the agent fails on every request without any error from
	// this function. Decimal inputs like "1.5" also parse to 1 ms. Pure-digit
	// inputs (the documented format for SPAWNER_*_TIMEOUT_MS env vars) are
	// unaffected; non-numeric, suffixed, or signed inputs fall back to the
	// caller-provided default.
	const raw = (env[key] || '').trim();
	if (!/^\d+$/.test(raw)) return fallbackMs;
	const parsed = Number.parseInt(raw, 10);
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
