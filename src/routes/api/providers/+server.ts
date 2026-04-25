import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { DEFAULT_MULTI_LLM_PROVIDERS } from '$lib/services/multi-llm-orchestrator';
import { resolveProviderRuntimeConfiguration } from '$lib/server/provider-config';

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
		providers: DEFAULT_MULTI_LLM_PROVIDERS.map((provider) => {
			const upperId = provider.id.toUpperCase().replace(/[^A-Z0-9]/g, '_');
			const sparkModel = envRecord[`SPARK_${upperId}_MODEL`];
			const model = sparkModel || envRecord[`${upperId}_MODEL`] || provider.model;
			const sparkBaseUrl = envRecord[`SPARK_${upperId}_BASE_URL`];
			const baseUrl = sparkBaseUrl || envRecord[`${upperId}_BASE_URL`] || provider.baseUrl || null;
			const sparkCommandTemplate = envRecord[`SPARK_${upperId}_COMMAND_TEMPLATE`];
			const commandTemplate =
				sparkCommandTemplate || envRecord[`${upperId}_COMMAND_TEMPLATE`] || provider.commandTemplate || null;
			const runtimeConfig = resolveProviderRuntimeConfiguration(provider, envRecord);

			return {
				id: provider.id,
				label: provider.label,
				kind: provider.kind,
				model,
				baseUrl,
				commandTemplate,
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
