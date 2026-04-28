import { describe, expect, it } from 'vitest';
import { DEFAULT_MULTI_LLM_PROVIDERS } from './multi-llm-orchestrator';
import {
	DEFAULT_RELAY_MISSION_PROVIDER_ID,
	resolveRelayMissionProvider
} from './relay-mission-provider';

describe('resolveRelayMissionProvider', () => {
	it('uses Codex as the default provider for Telegram relay missions', () => {
		const provider = resolveRelayMissionProvider(DEFAULT_MULTI_LLM_PROVIDERS);

		expect(provider?.id).toBe(DEFAULT_RELAY_MISSION_PROVIDER_ID);
	});

	it('honors an explicit configured relay mission provider when available', () => {
		const provider = resolveRelayMissionProvider(DEFAULT_MULTI_LLM_PROVIDERS, 'claude');

		expect(provider?.id).toBe('claude');
	});

	it('falls back to Codex instead of API chat providers when the requested provider is missing', () => {
		const provider = resolveRelayMissionProvider(DEFAULT_MULTI_LLM_PROVIDERS, 'missing-provider');

		expect(provider?.id).toBe('codex');
	});
});
