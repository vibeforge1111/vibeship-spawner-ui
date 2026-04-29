import { describe, expect, it } from 'vitest';
import {
	DEFAULT_AGENT_WORK_TIMEOUT_MS,
	DEFAULT_COMMAND_TIMEOUT_MS,
	agentWorkTimeoutMs,
	claudeAutoAnalysisTimeoutMs,
	commandTimeoutMs,
	positiveIntegerEnv,
	prdBridgeTimeoutMs,
	sparkHarnessTimeoutMs
} from './timeout-config';

describe('timeout-config', () => {
	it('uses positive integer environment values when present', () => {
		expect(positiveIntegerEnv({ TEST_TIMEOUT: '12345' }, 'TEST_TIMEOUT', 99)).toBe(12345);
		expect(agentWorkTimeoutMs({ SPAWNER_AGENT_WORK_TIMEOUT_MS: '60000' })).toBe(60000);
		expect(commandTimeoutMs({ SPAWNER_COMMAND_TIMEOUT_MS: '45000' })).toBe(45000);
	});

	it('falls back for missing, zero, negative, and non-numeric values', () => {
		for (const value of [undefined, '', '0', '-1', 'abc']) {
			expect(positiveIntegerEnv({ TEST_TIMEOUT: value }, 'TEST_TIMEOUT', 99)).toBe(99);
		}

		expect(agentWorkTimeoutMs({})).toBe(DEFAULT_AGENT_WORK_TIMEOUT_MS);
		expect(commandTimeoutMs({})).toBe(DEFAULT_COMMAND_TIMEOUT_MS);
	});

	it('lets specialized agent timeouts override the shared agent work timeout', () => {
		const env = {
			SPAWNER_AGENT_WORK_TIMEOUT_MS: '1000',
			SPAWNER_CLAUDE_TIMEOUT_MS: '2000',
			SPAWNER_PRD_BRIDGE_TIMEOUT_MS: '3000',
			SPAWNER_SPARK_HARNESS_TIMEOUT_MS: '4000'
		};

		expect(claudeAutoAnalysisTimeoutMs(env)).toBe(2000);
		expect(prdBridgeTimeoutMs(env)).toBe(3000);
		expect(sparkHarnessTimeoutMs(env)).toBe(4000);
	});

	it('uses the shared agent timeout for specialized agents when their override is invalid', () => {
		const env = {
			SPAWNER_AGENT_WORK_TIMEOUT_MS: '7000',
			SPAWNER_CLAUDE_TIMEOUT_MS: 'invalid',
			SPAWNER_PRD_BRIDGE_TIMEOUT_MS: '0',
			SPAWNER_SPARK_HARNESS_TIMEOUT_MS: '-5'
		};

		expect(claudeAutoAnalysisTimeoutMs(env)).toBe(7000);
		expect(prdBridgeTimeoutMs(env)).toBe(7000);
		expect(sparkHarnessTimeoutMs(env)).toBe(7000);
	});
});
