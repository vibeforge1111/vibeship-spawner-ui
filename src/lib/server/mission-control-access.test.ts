import { afterEach, describe, expect, it } from 'vitest';
import {
	missionControlPathForMission,
	resolveMissionControlAccess
} from './mission-control-access';

const ENV_KEYS = [
	'SPAWNER_MISSION_CONTROL_PUBLIC_URL',
	'MISSION_CONTROL_PUBLIC_URL',
	'SPARK_MISSION_CONTROL_PUBLIC_URL',
	'SPAWNER_MISSION_CONTROL_LAN_URL',
	'MISSION_CONTROL_LAN_URL'
];

function clearAccessEnv() {
	for (const key of ENV_KEYS) {
		delete process.env[key];
	}
}

afterEach(() => {
	clearAccessEnv();
});

describe('mission-control-access', () => {
	it('defaults to local-only so Telegram does not receive a fake localhost mobile link', () => {
		clearAccessEnv();

		const access = resolveMissionControlAccess('/missions/mission-1');

		expect(access).toMatchObject({
			mode: 'local-only',
			url: null,
			mobileReachable: false
		});
		expect(access.message).toContain('Localhost links will not open from Telegram on a phone');
		expect(access.privacy.privatePayloadsStayLocal).toBe(true);
	});

	it('rejects loopback public URLs as mobile-reachable links', () => {
		clearAccessEnv();
		process.env.SPAWNER_MISSION_CONTROL_PUBLIC_URL = 'http://127.0.0.1:3333';

		const access = resolveMissionControlAccess('/kanban');

		expect(access.mode).toBe('local-only');
		expect(access.url).toBeNull();
		expect(access.mobileReachable).toBe(false);
	});

	it('uses hosted HTTPS public URLs for mobile Mission Control links', () => {
		clearAccessEnv();
		process.env.SPAWNER_MISSION_CONTROL_PUBLIC_URL = 'https://mission.sparkswarm.ai/app';

		const access = resolveMissionControlAccess('/missions/mission-abc');

		expect(access).toMatchObject({
			mode: 'hosted',
			url: 'https://mission.sparkswarm.ai/app/missions/mission-abc',
			mobileReachable: true
		});
	});

	it('marks private network URLs as same-network only', () => {
		clearAccessEnv();
		process.env.SPAWNER_MISSION_CONTROL_LAN_URL = 'http://192.168.1.42:3333';

		const access = resolveMissionControlAccess('/canvas');

		expect(access).toMatchObject({
			mode: 'lan',
			url: 'http://192.168.1.42:3333/canvas',
			mobileReachable: false
		});
		expect(access.message).toContain('same private network');
	});

	it('builds mission detail paths without leaking raw ids into query strings', () => {
		expect(missionControlPathForMission(' mission-123 ')).toBe('/missions/mission-123');
		expect(missionControlPathForMission('')).toBe('/kanban');
	});
});
