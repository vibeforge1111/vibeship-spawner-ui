import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { DEFAULT_MULTI_LLM_PROVIDERS } from '$lib/services/multi-llm-orchestrator';

function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

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
		normalizeProviderId(envRecord.SPARK_LLM_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_SPARK_LLM_PROVIDER) ||
		normalizeProviderId(envRecord.SPARK_BOT_DEFAULT_PROVIDER) ||
		normalizeProviderId(envRecord.DEFAULT_MISSION_PROVIDER);

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

			return {
				id: provider.id,
				label: provider.label,
				model,
				baseUrl,
				commandTemplate,
				sparkExecutionBridge: provider.sparkExecutionBridge || null,
				executesFilesystem: provider.executesFilesystem === true,
				apiKeyEnv: provider.apiKeyEnv || null,
				envKeyConfigured: provider.apiKeyEnv
					? isConfiguredApiKey(envRecord[provider.apiKeyEnv])
					: false,
				sparkSelected: sparkDefaultProvider === provider.id
			};
		})
	});
};
