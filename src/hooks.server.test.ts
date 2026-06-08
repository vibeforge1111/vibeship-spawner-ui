import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	SPARK_UI_API_KEY: 'local-ui-key',
	SPARK_WORKSPACE_ID: 'private-workspace'
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { handle } from './hooks.server';
import { resetHostedUiAuthRateLimits, resetHostedUiSessions } from '$lib/server/hosted-ui-auth';

type FakeCookies = Cookies & {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

function resetEnv() {
	for (const key of Object.keys(PRIVATE_ENV)) delete PRIVATE_ENV[key];
	PRIVATE_ENV.SPARK_UI_API_KEY = 'local-ui-key';
	PRIVATE_ENV.SPARK_WORKSPACE_ID = 'private-workspace';
}

function fakeCookies(): FakeCookies {
	const values = new Map<string, string>();
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

function fakeEvent(url: string, clientAddress: string): RequestEvent {
	const request = new Request(url, { headers: { accept: 'application/json' } });
	return {
		request,
		url: new URL(url),
		cookies: fakeCookies(),
		getClientAddress: () => clientAddress,
		locals: {},
		params: {},
		platform: undefined,
		route: { id: null },
		setHeaders: vi.fn(),
		fetch
	} as unknown as RequestEvent;
}

describe('hooks.server hosted UI auth boundary', () => {
	afterEach(() => {
		resetEnv();
		resetHostedUiSessions();
		resetHostedUiAuthRateLimits();
	});

	it('lets local loopback API requests reach route handlers without a hosted access key', async () => {
		const resolve = vi.fn(async () => new Response('route reached', { status: 209 }));

		const response = await handle({
			event: fakeEvent('http://127.0.0.1:3333/api/providers', '127.0.0.1'),
			resolve
		});

		expect(resolve).toHaveBeenCalledTimes(1);
		expect(response.status).toBe(209);
		expect(await response.text()).toBe('route reached');
	});

	it('keeps hosted private-preview API requests gated without credentials', async () => {
		PRIVATE_ENV.SPARK_ALLOWED_HOSTS = 'spawner.example.com';
		PRIVATE_ENV.SPARK_HOSTED_PRIVATE_PREVIEW = '1';
		const resolve = vi.fn(async () => new Response('route reached'));

		const response = await handle({
			event: fakeEvent('https://spawner.example.com/api/providers', '203.0.113.10'),
			resolve
		});

		expect(resolve).not.toHaveBeenCalled();
		expect(response.status).toBe(401);
		expect(await response.text()).toContain('Spawner is private');
	});
});
