import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { DEFAULT_MULTI_LLM_PROVIDERS } from '$lib/services/multi-llm-orchestrator';
import { applyProviderEnvOverrides, resolveProviderRuntimeConfiguration } from '$lib/server/provider-config';

function normalizeProviderId(value: string | undefined): string | null {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	if (!normalized) return null;
	return DEFAULT_MULTI_LLM_PROVIDERS.some((provider) => provider.id === normalized)
		? normalized
		: null;
}

export const GET: RequestHandler = async () => {
	const envRecord = env as Record<string, string | undefined>;
	const sparkDefaultProvider =
		normalizeProviderId(envRecord.DEFAULT_MISSION_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_MISSION_LLM_BOT_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_MISSION_LLM_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_BOT_DEFAULT_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_LLM_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_SPARK_LLM_PROVIDER);

	return json({
		sparkDefaultProvider,
		providers: DEFAULT_MULTI_LLM_PROVIDERS.map((defaultProvider) => {
			const provider = applyProviderEnvOverrides(defaultProvider, envRecord, {
				missionDefaultProviderId: sparkDefaultProvider
			});
			const runtimeConfig = resolveProviderRuntimeConfiguration(provider, envRecord);

			return {
				id: provider.id,
				label: provider.label,
				kind: provider.kind,
				model: provider.model,
				baseUrl: provider.baseUrl || null,
				commandTemplate: provider.commandTemplate || null,
				sparkExecutionBridge: provider.sparkExecutionBridge || null,
				executesFilesystem: provider.executesFilesystem === true,
				apiKeyEnv: provider.apiKeyEnv || null,
				requiresApiKey: provider.requiresApiKey === true,
				envKeyConfigured: runtimeConfig.envKeyConfigured,
				cliConfigured: runtimeConfig.cliConfigured,
				cliPath: runtimeConfig.cliPath,
				configured: runtimeConfig.configured,
				configurationMode: runtimeConfig.configurationMode,
				sparkSelected: sparkDefaultProvider === provider.id
			};
		})
	});
};
