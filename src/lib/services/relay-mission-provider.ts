import type { MultiLLMProviderConfig } from './multi-llm-orchestrator';

export const DEFAULT_RELAY_MISSION_PROVIDER_ID = 'codex';

export function resolveRelayMissionProvider(
	providers: MultiLLMProviderConfig[],
	requestedProviderId = DEFAULT_RELAY_MISSION_PROVIDER_ID
): MultiLLMProviderConfig | null {
	return (
		providers.find((provider) => provider.id === requestedProviderId) ||
		providers.find((provider) => provider.id === DEFAULT_RELAY_MISSION_PROVIDER_ID) ||
		providers.find((provider) => provider.id === 'claude') ||
		providers[0] ||
		null
	);
}
