import { resolveCliBinary, type SparkCliBinary } from './cli-resolver';
import type { MultiLLMProviderConfig } from '$lib/services/multi-llm-orchestrator';

export type ProviderConfigurationMode = 'api_key' | 'cli' | 'none';

export interface ProviderRuntimeConfiguration {
	envKeyConfigured: boolean;
	cliConfigured: boolean;
	cliPath: string | null;
	configured: boolean;
	configurationMode: ProviderConfigurationMode;
}

function isCliProviderId(value: string): value is SparkCliBinary {
	return value === 'claude' || value === 'codex';
}

export function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

export function resolveProviderRuntimeConfiguration(
	provider: Pick<MultiLLMProviderConfig, 'id' | 'kind' | 'apiKeyEnv'>,
	envRecord: Record<string, string | undefined>
): ProviderRuntimeConfiguration {
	const envKeyConfigured = provider.apiKeyEnv
		? isConfiguredApiKey(envRecord[provider.apiKeyEnv])
		: false;
	const cliPath =
		provider.kind === 'terminal_cli' && isCliProviderId(provider.id)
			? resolveCliBinary(provider.id)
			: null;
	const cliConfigured = Boolean(cliPath);
	const configured = envKeyConfigured || cliConfigured;
	const configurationMode: ProviderConfigurationMode = cliConfigured
		? 'cli'
		: envKeyConfigured
			? 'api_key'
			: 'none';

	return {
		envKeyConfigured,
		cliConfigured,
		cliPath,
		configured,
		configurationMode
	};
}
