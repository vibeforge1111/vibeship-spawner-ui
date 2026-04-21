import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { DEFAULT_MULTI_LLM_PROVIDERS } from '$lib/services/multi-llm-orchestrator';

function isConfiguredApiKey(value: string | undefined): value is string {
	return Boolean(value && value.trim() && !value.startsWith('your_'));
}

export const GET: RequestHandler = async () => {
	const envRecord = env as Record<string, string | undefined>;

	return json({
		providers: DEFAULT_MULTI_LLM_PROVIDERS.map((provider) => ({
			id: provider.id,
			label: provider.label,
			model: provider.model,
			apiKeyEnv: provider.apiKeyEnv || null,
			envKeyConfigured: provider.apiKeyEnv
				? isConfiguredApiKey(envRecord[provider.apiKeyEnv])
				: false
		}))
	});
};
