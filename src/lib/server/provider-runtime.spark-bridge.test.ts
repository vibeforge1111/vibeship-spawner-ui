import { describe, expect, it } from 'vitest';

import type { MultiLLMProviderConfig } from '$lib/services/multi-llm-orchestrator';
import { providerShouldUseSparkExecutionBridge } from './provider-runtime';

const bridgedProvider: Pick<MultiLLMProviderConfig, 'sparkExecutionBridge'> = {
	sparkExecutionBridge: 'codex'
};

describe('providerShouldUseSparkExecutionBridge', () => {
	it('does not force API providers through a missing local Spark harness', () => {
		expect(providerShouldUseSparkExecutionBridge(bridgedProvider, {})).toBe(false);
	});

	it('uses the Spark harness when the harness URL is explicitly configured', () => {
		expect(
			providerShouldUseSparkExecutionBridge(bridgedProvider, {
				SPARK_HARNESS_URL: 'http://127.0.0.1:8011'
			})
		).toBe(true);
	});

	it('ignores providers without a bridge declaration', () => {
		expect(providerShouldUseSparkExecutionBridge({}, { SPARK_HARNESS_URL: 'http://127.0.0.1:8011' })).toBe(false);
	});
});
