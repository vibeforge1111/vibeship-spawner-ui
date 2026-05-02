import { resolveCliBinary, type SparkCliBinary } from './cli-resolver';
import type { MultiLLMProviderConfig } from '$lib/services/multi-llm-orchestrator';

export type ProviderConfigurationMode = 'api_key' | 'cli' | 'local' | 'none';

export interface ProviderRuntimeConfiguration {
	envKeyConfigured: boolean;
	cliConfigured: boolean;
	cliPath: string | null;
	configured: boolean;
	configurationMode: ProviderConfigurationMode;
}

export interface ProviderEnvOverrideOptions {
	missionDefaultProviderId?: string | null;
}

function isCliProviderId(value: string): value is SparkCliBinary {
	return value === 'claude' || value === 'codex';
}

function isHostedRuntime(envRecord: Record<string, string | undefined>): boolean {
	return Boolean(
		envRecord.RAILWAY_ENVIRONMENT ||
			envRecord.RAILWAY_SERVICE_NAME ||
			envRecord.RAILWAY_PROJECT_ID ||
			envRecord.SPARK_LIVE_CONTAINER === '1' ||
			envRecord.SPARK_SPAWNER_HOST === '0.0.0.0' ||
			envRecord.HOST === '0.0.0.0'
	);
}

function isLoopbackBaseUrl(value: string | undefined): boolean {
	if (!value) return true;
	try {
		const hostname = new URL(value).hostname.toLowerCase();
		return (
			hostname === 'localhost' ||
			hostname === '0.0.0.0' ||
			hostname === '::1' ||
			hostname.startsWith('127.')
		);
	} catch {
		return true;
	}
}

function isLocalOpenAICompatProvider(providerId: string): boolean {
	return providerId === 'lmstudio' || providerId === 'ollama';
}

export function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

export function resolveProviderRuntimeConfiguration(
	provider: Pick<MultiLLMProviderConfig, 'id' | 'kind' | 'apiKeyEnv' | 'baseUrl'>,
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
	const localOpenAICompatConfigured =
		provider.kind === 'openai_compat' &&
		!provider.apiKeyEnv &&
		isLocalOpenAICompatProvider(provider.id) &&
		(!isHostedRuntime(envRecord) || !isLoopbackBaseUrl(provider.baseUrl));
	const configured = envKeyConfigured || cliConfigured || localOpenAICompatConfigured;
	const configurationMode: ProviderConfigurationMode = cliConfigured
		? 'cli'
		: envKeyConfigured
			? 'api_key'
			: localOpenAICompatConfigured
				? 'local'
				: 'none';

	return {
		envKeyConfigured,
		cliConfigured,
		cliPath,
		configured,
		configurationMode
	};
}

function providerEnvPrefix(providerId: string): string {
	return providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

function firstConfigured(...values: Array<string | undefined>): string | undefined {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return undefined;
}

export function applyProviderEnvOverrides<T extends MultiLLMProviderConfig>(
	provider: T,
	envRecord: Record<string, string | undefined>,
	options: ProviderEnvOverrideOptions = {}
): T {
	const upperId = providerEnvPrefix(provider.id);
	const isMissionDefault = options.missionDefaultProviderId === provider.id;
	const model = firstConfigured(
		isMissionDefault ? envRecord.SPARK_MISSION_LLM_MODEL : undefined,
		envRecord[`SPARK_${upperId}_MODEL`],
		envRecord[`${upperId}_MODEL`]
	);
	const baseUrl = firstConfigured(
		isMissionDefault ? envRecord.SPARK_MISSION_LLM_BASE_URL : undefined,
		envRecord[`SPARK_${upperId}_BASE_URL`],
		envRecord[`${upperId}_BASE_URL`]
	);
	const commandTemplate = firstConfigured(
		isMissionDefault ? envRecord.SPARK_MISSION_LLM_COMMAND_TEMPLATE : undefined,
		envRecord[`SPARK_${upperId}_COMMAND_TEMPLATE`],
		envRecord[`${upperId}_COMMAND_TEMPLATE`]
	);

	return {
		...provider,
		...(model ? { model } : {}),
		...(baseUrl ? { baseUrl } : {}),
		...(commandTemplate ? { commandTemplate } : {})
	};
}
