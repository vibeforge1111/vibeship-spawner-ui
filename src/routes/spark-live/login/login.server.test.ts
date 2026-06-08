import type { Cookies } from '@sveltejs/kit';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PRIVATE_ENV = vi.hoisted((): Record<string, string | undefined> => ({
	SPARK_UI_API_KEY: 'local-login-test-key'
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

import { load } from './+page.server';
import { resetHostedUiSessions } from '$lib/server/hosted-ui-auth';

type FakeCookies = Cookies & {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
	delete: ReturnType<typeof vi.fn>;
};

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

function loadEvent(url: string, init: RequestInit = {}) {
	return {
		cookies: fakeCookies(),
		request: new Request(url, {
			headers: { accept: 'text/html', ...init.headers },
			...init
		}),
		url: new URL(url)
	};
}

describe('spark-live login page', () => {
	afterEach(() => {
		resetHostedUiSessions();
		PRIVATE_ENV.SPARK_UI_API_KEY = 'local-login-test-key';
		PRIVATE_ENV.SPARK_WORKSPACE_ID = undefined;
		PRIVATE_ENV.SPARK_LIVE_CONTAINER = undefined;
	});

	it('opens the requested local Mission Control surface instead of showing the hosted gate', async () => {
		const event = loadEvent('http://127.0.0.1:3333/spark-live/login?next=%2Fkanban');
		let redirectError: unknown;

		try {
			load(event as never);
		} catch (error) {
			redirectError = error;
		}

		expect(redirectError).toMatchObject({
			status: 303,
			location: '/kanban'
		});
		expect(event.cookies.set).toHaveBeenCalledWith(
			'spawner_ui_session',
			expect.any(String),
			expect.objectContaining({ httpOnly: true, secure: false })
		);
	});

	it('keeps hosted workspace login gated', async () => {
		PRIVATE_ENV.SPARK_WORKSPACE_ID = 'private-workspace';

		expect(load(loadEvent('https://spawner.example.com/spark-live/login?next=%2Fkanban') as never)).toEqual({
			next: '/kanban',
			workspaceRequired: true
		});
	});
});
