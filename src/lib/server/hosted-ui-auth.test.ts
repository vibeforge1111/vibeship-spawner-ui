import { describe, expect, it, vi } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import {
	hostedUiAuthEnabled,
	hostedUiAuthPathIsExempt,
	hostedUiRequestToken,
	hostedUiTokenIsValid,
	persistHostedUiAuth
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

	it('exempts static assets', () => {
		expect(hostedUiAuthPathIsExempt('/_app/immutable/app.js')).toBe(true);
		expect(hostedUiAuthPathIsExempt('/api/providers')).toBe(false);
	});

	it('accepts query, header, bearer, and cookie tokens', () => {
		const cookies = fakeCookies({ spawner_ui_api_key: 'cookie-key' });
		expect(hostedUiRequestToken(new Request('https://x.test/?uiKey=query-key'), new URL('https://x.test/?uiKey=query-key'), cookies)).toBe('query-key');
		expect(hostedUiRequestToken(new Request('https://x.test/', { headers: { 'x-spawner-ui-key': 'header-key' } }), new URL('https://x.test/'), cookies)).toBe('header-key');
		expect(hostedUiRequestToken(new Request('https://x.test/', { headers: { authorization: 'Bearer bearer-key' } }), new URL('https://x.test/'), cookies)).toBe('bearer-key');
		expect(hostedUiRequestToken(new Request('https://x.test/'), new URL('https://x.test/'), cookies)).toBe('cookie-key');
	});

	it('persists UI, control, and events cookies without exposing keys to JavaScript', () => {
		const cookies = fakeCookies();
		persistHostedUiAuth(cookies, {
			SPARK_UI_API_KEY: 'ui-key',
			SPARK_BRIDGE_API_KEY: 'bridge-key',
			EVENTS_API_KEY: 'events-key'
		});

		expect(cookies.set).toHaveBeenCalledWith('spawner_ui_api_key', 'ui-key', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
		expect(cookies.set).toHaveBeenCalledWith('spawner_control_api_key', 'bridge-key', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
		expect(cookies.set).toHaveBeenCalledWith('spawner_events_api_key', 'events-key', expect.objectContaining({ httpOnly: true, sameSite: 'strict' }));
	});

	it('compares tokens exactly', () => {
		expect(hostedUiTokenIsValid('secret', { SPARK_UI_API_KEY: 'secret' })).toBe(true);
		expect(hostedUiTokenIsValid('wrong', { SPARK_UI_API_KEY: 'secret' })).toBe(false);
	});
});
