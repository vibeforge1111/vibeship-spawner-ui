import { describe, expect, it } from 'vitest';
import { buildHostedSetupStatus } from './hosted-setup-status';

describe('hosted setup status', () => {
	it('reports a ready hosted setup without exposing secret values', () => {
		const status = buildHostedSetupStatus({
			SPARK_LIVE_CONTAINER: '1',
			SPARK_HOSTED_PRIVATE_PREVIEW: '1',
			SPARK_WORKSPACE_ID: 'founder-private-spawner',
			SPARK_UI_API_KEY: 'ui-secret-value-that-is-long',
			SPARK_BRIDGE_API_KEY: 'bridge-secret-value-that-is-long',
			SPARK_ALLOWED_HOSTS: 'spark.example.com',
			BOT_TOKEN: '123456:telegram-token-value',
			ADMIN_TELEGRAM_IDS: '123456789',
			SPARK_LLM_PROVIDER: 'zai',
			SPARK_CHAT_LLM_PROVIDER: 'zai',
			SPARK_MISSION_LLM_PROVIDER: 'zai',
			ZAI_API_KEY: 'zai-secret-value'
		});

		expect(status.hosted).toBe(true);
		expect(status.ready).toBe(true);
		expect(status.allowedHosts).toEqual(['spark.example.com']);
		expect(status.roles).toEqual({ agent: 'zai', mission: 'zai' });
		expect(status.configuredProviders).toContain('zai');
		expect(JSON.stringify(status)).not.toContain('ui-secret-value-that-is-long');
		expect(JSON.stringify(status)).not.toContain('telegram-token-value');
		expect(JSON.stringify(status)).not.toContain('zai-secret-value');
	});

	it('points users at missing hosted setup steps', () => {
		const status = buildHostedSetupStatus({
			SPARK_SPAWNER_HOST: '0.0.0.0',
			SPARK_ALLOWED_HOSTS: '*',
			SPARK_LLM_PROVIDER: 'zai'
		});

		expect(status.hosted).toBe(true);
		expect(status.ready).toBe(false);
		expect(status.checks.find((check) => check.id === 'ui-auth')?.ok).toBe(false);
		expect(status.checks.find((check) => check.id === 'private-preview')?.ok).toBe(false);
		expect(status.checks.find((check) => check.id === 'workspace-id')?.ok).toBe(false);
		expect(status.checks.find((check) => check.id === 'bridge-auth')?.ok).toBe(false);
		expect(status.checks.find((check) => check.id === 'allowed-hosts')?.ok).toBe(false);
		expect(status.checks.find((check) => check.id === 'telegram')?.fix).toMatch(/spark setup/);
		expect(status.checks.find((check) => check.id === 'mission-llm')?.fix).toMatch(/SPARK_MISSION_LLM_PROVIDER/);
	});

	it('warns when hosted full access has been explicitly enabled', () => {
		const status = buildHostedSetupStatus({
			SPARK_LIVE_CONTAINER: '1',
			SPARK_HOSTED_PRIVATE_PREVIEW: '1',
			SPARK_WORKSPACE_ID: 'private-workspace',
			SPARK_ALLOW_HOSTED_FULL_ACCESS: '1'
		});

		const fullAccess = status.checks.find((check) => check.id === 'full-access');
		expect(fullAccess?.ok).toBe(false);
		expect(fullAccess?.detail).toMatch(/explicitly enabled/);
	});
});
