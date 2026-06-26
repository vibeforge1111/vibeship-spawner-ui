import { describe, expect, it, vi } from 'vitest';

const privateEnv = vi.hoisted(() => ({
	SPARK_UI_API_KEY: undefined as string | undefined
}));

vi.mock('$env/dynamic/private', () => ({
	env: privateEnv
}));

vi.mock('$lib/server/hosted-ui-auth', () => ({
	hostedUiSessionIsValid: vi.fn(),
	hostedUiAuthEnabled: vi.fn()
}));

import { hostedUiSessionIsValid, hostedUiAuthEnabled } from '$lib/server/hosted-ui-auth';
import {
	createCapabilityEnvelope,
	assertCapability,
	CapabilityPolicyError
} from './capability-policy';

function createFakeEvent(options: {
	cookies?: Record<string, string>;
	headers?: Record<string, string>;
} = {}) {
	const cookieStore = new Map(Object.entries(options.cookies ?? {}));
	const headerStore = new Map(Object.entries(options.headers ?? {}));

	return {
		cookies: {
			get: vi.fn((name: string) => cookieStore.get(name)),
			getAll: vi.fn(() =>
				Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }))
			),
			set: vi.fn(),
			delete: vi.fn()
		},
		request: {
			headers: {
				get: vi.fn((name: string) => headerStore.get(name) ?? null)
			}
		}
	} as never;
}

describe('capability-policy', () => {
	beforeEach(() => {
		privateEnv.SPARK_UI_API_KEY = undefined;
		vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);
		vi.mocked(hostedUiAuthEnabled).mockReturnValue(false);
	});

	describe('actorFromRequest access level escalation', () => {
		it('grants accessLevel 4 to local users without hosted auth', () => {
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'canvas.read',
				target: 'test',
				reason: 'test'
			});

			expect(envelope.accessLevel).toBe(4);
			expect(envelope.actorKind).toBe('local-user');
		});

		it('denies accessLevel 4 when hosted auth is enabled but no valid session', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'canvas.read',
				target: 'test',
				reason: 'test'
			});

			expect(envelope.accessLevel).toBe(0);
		});

		it('grants accessLevel 1 to valid hosted-ui session', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(true);

			const event = createFakeEvent({
				cookies: { spawner_ui_session: 'session-id' }
			});
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'canvas.read',
				target: 'test',
				reason: 'test'
			});

			expect(envelope.accessLevel).toBe(1);
			expect(envelope.actorKind).toBe('hosted-user');
		});

		it('blocks shell.execute for unauthenticated hosted users', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'shell.execute',
				target: 'test',
				reason: 'test'
			});

			expect(() => assertCapability(envelope)).toThrow(CapabilityPolicyError);
			expect(() => assertCapability(envelope)).toThrow(/access level/);
		});

		it('blocks secrets.read for unauthenticated hosted users', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'secrets.read',
				target: 'test',
				reason: 'test'
			});

			expect(() => assertCapability(envelope)).toThrow(CapabilityPolicyError);
		});

		it('blocks filesystem.write for unauthenticated hosted users', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'filesystem.write',
				target: 'test',
				reason: 'test'
			});

			expect(() => assertCapability(envelope)).toThrow(CapabilityPolicyError);
		});

		it('allows canvas.read for unauthenticated hosted users (accessLevel 1)', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'canvas.read',
				target: 'test',
				reason: 'test'
			});

			// canvas.read requires accessLevel 1, but unauthenticated gets 0
			expect(() => assertCapability(envelope)).toThrow(CapabilityPolicyError);
		});

		it('allows canvas.read with accessLevel 0 check', () => {
			privateEnv.SPARK_UI_API_KEY = 'hosted-ui-key';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'canvas.read',
				target: 'test',
				reason: 'test'
			});

			// accessLevel 0 < 1 (required for canvas.read), so should throw
			expect(() => assertCapability(envelope)).toThrow(CapabilityPolicyError);
		});
	});

	describe('assertCapability', () => {
		it('allows canvas.read for local users with accessLevel 4', () => {
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(false);

			const event = createFakeEvent();
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'canvas.read',
				target: 'test',
				reason: 'test'
			});

			expect(() => assertCapability(envelope)).not.toThrow();
		});

		it('blocks hosted users from local runtime capabilities', () => {
			privateEnv.SPARK_UI_API_KEY='***';
			vi.mocked(hostedUiAuthEnabled).mockReturnValue(true);
			vi.mocked(hostedUiSessionIsValid).mockReturnValue(true);

			const event = createFakeEvent({
				cookies: { spawner_ui_session: 'session-id' }
			});
			const envelope = createCapabilityEnvelope(event, {
				surface: 'spawner',
				capability: 'shell.execute',
				target: 'test',
				reason: 'test'
			});

			// Hosted user gets accessLevel 1, which is too low for shell.execute (needs 4)
			// AND hosted users are blocked from local runtime capabilities
			expect(() => assertCapability(envelope)).toThrow(CapabilityPolicyError);
		});
	});
});
