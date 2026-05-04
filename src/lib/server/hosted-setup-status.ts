import { DEFAULT_MULTI_LLM_PROVIDERS } from '$lib/services/multi-llm-orchestrator';
import { applyProviderEnvOverrides, resolveProviderRuntimeConfiguration } from '$lib/server/provider-config';

export interface HostedSetupEnv {
	[key: string]: string | undefined;
	SPARK_UI_API_KEY?: string;
	SPARK_WORKSPACE_ID?: string;
	SPARK_HOSTED_PRIVATE_PREVIEW?: string;
	SPARK_BRIDGE_API_KEY?: string;
	SPARK_ALLOWED_HOSTS?: string;
	SPARK_LIVE_CONTAINER?: string;
	SPARK_SPAWNER_HOST?: string;
	BOT_TOKEN?: string;
	TELEGRAM_BOT_TOKEN?: string;
	ADMIN_TELEGRAM_IDS?: string;
	ALLOWED_TELEGRAM_IDS?: string;
	SPARK_LLM_PROVIDER?: string;
	SPARK_CHAT_LLM_PROVIDER?: string;
	SPARK_BUILDER_LLM_PROVIDER?: string;
	SPARK_MEMORY_LLM_PROVIDER?: string;
	SPARK_MISSION_LLM_PROVIDER?: string;
	SPARK_ALLOW_HOSTED_FULL_ACCESS?: string;
}

export interface HostedSetupCheck {
	id: string;
	label: string;
	ok: boolean;
	detail: string;
	fix: string;
}

export interface HostedSetupStatus {
	hosted: boolean;
	ready: boolean;
	allowedHosts: string[];
	roles: {
		agent: string;
		mission: string;
	};
	configuredProviders: string[];
	checks: HostedSetupCheck[];
}

function configured(value: string | undefined): boolean {
	const trimmed = value?.trim();
	return Boolean(trimmed && !trimmed.startsWith('your_') && !trimmed.includes('<') && !trimmed.includes('>'));
}

function firstConfigured(...values: Array<string | undefined>): string {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return 'not configured';
}

function parseAllowedHosts(value: string | undefined): string[] {
	return (value || '')
		.split(',')
		.map((host) => host.trim())
		.filter(Boolean);
}

function normalizeProviderId(value: string): string | null {
	const normalized = value.trim().toLowerCase();
	return DEFAULT_MULTI_LLM_PROVIDERS.some((provider) => provider.id === normalized) ? normalized : null;
}

export function buildHostedSetupStatus(env: HostedSetupEnv): HostedSetupStatus {
	const allowedHosts = parseAllowedHosts(env.SPARK_ALLOWED_HOSTS);
	const hosted = env.SPARK_LIVE_CONTAINER === '1' || env.SPARK_SPAWNER_HOST === '0.0.0.0' || allowedHosts.length > 0;
	const agentProvider = firstConfigured(
		env.SPARK_CHAT_LLM_PROVIDER,
		env.SPARK_BUILDER_LLM_PROVIDER,
		env.SPARK_MEMORY_LLM_PROVIDER,
		env.SPARK_LLM_PROVIDER
	);
	const missionProvider = firstConfigured(env.SPARK_MISSION_LLM_PROVIDER, env.SPARK_LLM_PROVIDER);
	const normalizedMissionProvider = normalizeProviderId(missionProvider);
	const configuredProviders = DEFAULT_MULTI_LLM_PROVIDERS.map((defaultProvider) => {
		const provider = applyProviderEnvOverrides(defaultProvider, env, {
			missionDefaultProviderId: normalizedMissionProvider
		});
		const runtime = resolveProviderRuntimeConfiguration(provider, env);
		return runtime.configured ? provider.id : null;
	}).filter((providerId): providerId is string => Boolean(providerId));

	const checks: HostedSetupCheck[] = [
		{
			id: 'private-preview',
			label: 'Private preview lock',
			ok: !hosted || env.SPARK_HOSTED_PRIVATE_PREVIEW === '1',
			detail:
				!hosted
					? 'Local development is not public.'
					: env.SPARK_HOSTED_PRIVATE_PREVIEW === '1'
						? 'Hosted Spawner is intentionally enabled for private preview.'
						: 'Hosted Spawner is locked for this release so public users cannot enter the control surface.',
			fix: 'Only set SPARK_HOSTED_PRIVATE_PREVIEW=1 for a trusted private preview after workspace ID and access keys are configured.'
		},
		{
			id: 'workspace-id',
			label: 'Workspace ID',
			ok: !hosted || configured(env.SPARK_WORKSPACE_ID),
			detail: configured(env.SPARK_WORKSPACE_ID)
				? 'Visitors must know the private workspace ID before they can enter.'
				: hosted
					? 'Hosted Spawner needs a private workspace ID before it can feel like a personal workspace.'
					: 'Local development does not need a hosted workspace ID.',
			fix: 'Set SPARK_WORKSPACE_ID to a non-guessable workspace slug and share it only with the workspace owner.'
		},
		{
			id: 'ui-auth',
			label: 'Browser access key',
			ok: configured(env.SPARK_UI_API_KEY),
			detail: configured(env.SPARK_UI_API_KEY)
				? 'Spark Live browser access is protected.'
				: 'Spark Live needs a private browser access key before it is public.',
			fix: 'Set SPARK_UI_API_KEY to a long random value in the host environment.'
		},
		{
			id: 'bridge-auth',
			label: 'Bridge API key',
			ok: configured(env.SPARK_BRIDGE_API_KEY),
			detail: configured(env.SPARK_BRIDGE_API_KEY)
				? 'Internal Spark APIs require the bridge key.'
				: 'Mission relay APIs need a separate bridge key.',
			fix: 'Set SPARK_BRIDGE_API_KEY to a different long random value.'
		},
		{
			id: 'allowed-hosts',
			label: 'Public host allowlist',
			ok: allowedHosts.length > 0 && !allowedHosts.some((host) => host === '*' || host.includes('/')),
			detail:
				allowedHosts.length > 0
					? `Allowed host count: ${allowedHosts.length}.`
					: 'No public host allowlist is configured yet.',
			fix: 'Set SPARK_ALLOWED_HOSTS to the exact public hostname, for example spark.example.com.'
		},
		{
			id: 'telegram',
			label: 'Telegram bot',
			ok: configured(env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN) && configured(env.ADMIN_TELEGRAM_IDS || env.ALLOWED_TELEGRAM_IDS),
			detail: configured(env.BOT_TOKEN || env.TELEGRAM_BOT_TOKEN)
				? 'Telegram token is present; admin IDs are checked separately.'
				: 'Telegram needs a BotFather token and at least one admin Telegram ID.',
			fix: 'Run spark setup and provide the BotFather token plus your /myid Telegram ID.'
		},
		{
			id: 'agent-llm',
			label: 'Agent LLM',
			ok: agentProvider !== 'not configured' && configuredProviders.includes(normalizeProviderId(agentProvider) || agentProvider),
			detail: agentProvider === 'not configured' ? 'No chat/agent provider selected.' : `Agent route: ${agentProvider}.`,
			fix: 'Run spark setup --llm-provider <provider> or set SPARK_LLM_PROVIDER plus the matching auth.'
		},
		{
			id: 'mission-llm',
			label: 'Mission LLM',
			ok: missionProvider !== 'not configured' && configuredProviders.includes(normalizeProviderId(missionProvider) || missionProvider),
			detail: missionProvider === 'not configured' ? 'No mission provider selected.' : `Mission route: ${missionProvider}.`,
			fix: 'Run spark setup --llm-provider <provider>, or set SPARK_MISSION_LLM_PROVIDER for mission-only routing.'
		},
		{
			id: 'full-access',
			label: 'Full Access safety',
			ok: env.SPARK_ALLOW_HOSTED_FULL_ACCESS !== '1',
			detail:
				env.SPARK_ALLOW_HOSTED_FULL_ACCESS === '1'
					? 'Hosted Full Access is explicitly enabled. Keep approval guardrails on.'
					: 'Hosted Full Access is locked by default, which is safest for public/VPS installs.',
			fix: 'Leave SPARK_ALLOW_HOSTED_FULL_ACCESS unset unless you intentionally operate a private, approval-gated host.'
		}
	];

	return {
		hosted,
		ready: checks.every((check) => check.ok || check.id === 'full-access'),
		allowedHosts,
		roles: {
			agent: agentProvider,
			mission: missionProvider
		},
		configuredProviders,
		checks
	};
}
