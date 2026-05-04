import { describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import {
	hostedUiAuthEnabled,
	hostedUiCredentialsAreValid,
	hostedUiAuthClientKey,
	hostedUiAuthPathIsExempt,
	hostedUiAuthRateLimitStatus,
	hostedUiReleaseLockPathIsExempt,
	hostedUiReleaseLocked,
	hostedUiRequestToken,
	hostedUiRequestWorkspaceId,
	hostedUiTokenIsValid,
	persistHostedUiAuth,
	recordHostedUiAuthFailure,
	resetHostedUiAuthRateLimits
} from './hosted-ui-auth';

type FakeCookies = Cookies & {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
};

function fakeCookies(initial: Record<string, string> = {}): FakeCookies {
	const values = new Map(Object.entries(initial));
	return {
		get: vi.fn((name: string) => values.get(name)),
		getAll: vi.fn(() => Array.from(values, ([name, value]) => ({ name, value }))),
		set: vi.fn((name: string, value: string) => {
			values.set(name, value);
		}),
		delete: vi.fn((name: string) => {
			values.delete(name);
		}),
		serialize: vi.fn((name: string, value: string) => `${name}=${value}`)
	} as unknown as FakeCookies;
}

describe('hosted UI auth', () => {
	it('is enabled only when a UI key is configured', () => {
		expect(hostedUiAuthEnabled({})).toBe(false);
		expect(hostedUiAuthEnabled({ SPARK_UI_API_KEY: 'secret' })).toBe(true);
	});

	it('locks hosted deployments unless private preview is explicit', () => {
		expect(hostedUiReleaseLocked({})).toBe(false);
		expect(hostedUiReleaseLocked({ SPARK_LIVE_CONTAINER: '1' })).toBe(true);
		expect(hostedUiReleaseLocked({ SPARK_SPAWNER_HOST: '0.0.0.0' })).toBe(true);
		expect(hostedUiReleaseLocked({ SPARK_ALLOWED_HOSTS: 'spark.example.com' })).toBe(true);
		expect(hostedUiReleaseLocked({ RAILWAY_PUBLIC_DOMAIN: 'spawner.example.up.railway.app' })).toBe(true);
		expect(hostedUiReleaseLocked({ RENDER_EXTERNAL_URL: 'https://spawner.example.com' })).toBe(true);
		expect(hostedUiReleaseLocked({ FLY_APP_NAME: 'spawner-ui' })).toBe(true);
		expect(hostedUiReleaseLocked({ VERCEL_URL: 'spawner.example.com' })).toBe(true);
		expect(hostedUiReleaseLocked({ NETLIFY: 'true' })).toBe(true);
		expect(hostedUiReleaseLocked({ SPARK_LIVE_CONTAINER: '1', SPARK_HOSTED_PRIVATE_PREVIEW: '1' })).toBe(false);
	});

	it('lets only the public landing page through the release lock', () => {
		expect(hostedUiReleaseLockPathIsExempt('/')).toBe(true);
		expect(hostedUiReleaseLockPathIsExempt('/canvas')).toBe(false);
		expect(hostedUiReleaseLockPathIsExempt('/kanban')).toBe(false);
		expect(hostedUiReleaseLockPathIsExempt('/api/mission-control/board')).toBe(false);
		expect(hostedUiReleaseLockPathIsExempt('/spark-live/login')).toBe(false);
	});

	it('exempts static assets', () => {
		expect(hostedUiAuthPathIsExempt('/_app/immutable/app.js')).toBe(true);
		expect(hostedUiAuthPathIsExempt('/favicon.png')).toBe(true);
		expect(hostedUiAuthPathIsExempt('/robots.txt')).toBe(true);
		expect(hostedUiAuthPathIsExempt('/spark-live/login')).toBe(true);
		expect(hostedUiAuthPathIsExempt('/spark-live/login-extra')).toBe(false);
		expect(hostedUiAuthPathIsExempt('/spark-live/setup')).toBe(false);
		expect(hostedUiAuthPathIsExempt('/api/providers')).toBe(false);
	});

	it('accepts query, header, bearer, and cookie tokens', () => {
		const cookies = fakeCookies({ spawner_ui_api_key: 'cookie-key' });
		expect(hostedUiRequestToken(new Request('https://x.test/?uiKey=query-key'), new URL('https://x.test/?uiKey=query-key'), cookies)).toBe('query-key');
		expect(hostedUiRequestToken(new Request('https://x.test/', { headers: { 'x-spawner-ui-key': 'header-key' } }), new URL('https://x.test/'), cookies)).toBe('header-key');
		expect(hostedUiRequestToken(new Request('https://x.test/', { headers: { authorization: 'Bearer bearer-key' } }), new URL('https://x.test/'), cookies)).toBe('bearer-key');
		expect(hostedUiRequestToken(new Request('https://x.test/'), new URL('https://x.test/'), cookies)).toBe('cookie-key');
	});

	it('accepts workspace id from query, header, and cookie', () => {
		const cookies = fakeCookies({ spawner_workspace_id: 'cookie-workspace' });
		expect(hostedUiRequestWorkspaceId(new Request('https://x.test/?workspaceId=query-workspace'), new URL('https://x.test/?workspaceId=query-workspace'), cookies)).toBe('query-workspace');
		expect(hostedUiRequestWorkspaceId(new Request('https://x.test/', { headers: { 'x-spawner-workspace-id': 'header-workspace' } }), new URL('https://x.test/'), cookies)).toBe('header-workspace');
		expect(hostedUiRequestWorkspaceId(new Request('https://x.test/'), new URL('https://x.test/'), cookies)).toBe('cookie-workspace');
	});

	it('persists UI, control, and events cookies without exposing keys to JavaScript', () => {
		const cookies = fakeCookies();
		persistHostedUiAuth(cookies, {
			SPARK_WORKSPACE_ID: 'private-workspace',
			SPARK_UI_API_KEY: 'ui-key',
			SPARK_BRIDGE_API_KEY: 'bridge-key',
			EVENTS_API_KEY: 'events-key'
		});

		expect(cookies.set).toHaveBeenCalledWith('spawner_workspace_id', 'private-workspace', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
		expect(cookies.set).toHaveBeenCalledWith('spawner_ui_api_key', 'ui-key', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
		expect(cookies.set).toHaveBeenCalledWith('spawner_control_api_key', 'bridge-key', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
		expect(cookies.set).toHaveBeenCalledWith('spawner_events_api_key', 'events-key', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
	});

	it('compares tokens exactly', () => {
		expect(hostedUiTokenIsValid('secret', { SPARK_UI_API_KEY: 'secret' })).toBe(true);
		expect(hostedUiTokenIsValid('wrong', { SPARK_UI_API_KEY: 'secret' })).toBe(false);
	});

	it('requires matching workspace id when configured', () => {
		const env = { SPARK_WORKSPACE_ID: 'my-private-spawner', SPARK_UI_API_KEY: 'secret' };
		expect(hostedUiCredentialsAreValid('my-private-spawner', 'secret', env)).toBe(true);
		expect(hostedUiCredentialsAreValid('other-workspace', 'secret', env)).toBe(false);
		expect(hostedUiCredentialsAreValid(null, 'secret', env)).toBe(false);
		expect(hostedUiCredentialsAreValid('my-private-spawner', 'wrong', env)).toBe(false);
	});

	it('uses forwarded IP as the hosted auth rate-limit key', () => {
		const request = new Request('https://x.test/', { headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } });
		expect(hostedUiAuthClientKey(request)).toBe('203.0.113.10');
	});

	it('rate-limits repeated hosted auth failures within the window', () => {
		resetHostedUiAuthRateLimits();
		for (let i = 0; i < 12; i += 1) {
			recordHostedUiAuthFailure('client-a', 1_000);
		}
		expect(hostedUiAuthRateLimitStatus('client-a', 2_000)).toEqual({ blocked: true, retryAfterSeconds: 59 });
		expect(hostedUiAuthRateLimitStatus('client-a', 62_000)).toEqual({ blocked: false, retryAfterSeconds: 0 });
	});
});
