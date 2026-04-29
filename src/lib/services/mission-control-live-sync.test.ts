import { describe, expect, it } from 'vitest';
import {
	shouldLiveSyncMissionControl,
	shouldSkipMissionControlHydration
} from './mission-control-live-sync';

describe('mission-control live sync helpers', () => {
	it('live-syncs only while the execution panel can still change', () => {
		expect(shouldLiveSyncMissionControl('creating')).toBe(true);
		expect(shouldLiveSyncMissionControl('running')).toBe(true);
		expect(shouldLiveSyncMissionControl('paused')).toBe(true);
		expect(shouldLiveSyncMissionControl('completed')).toBe(false);
		expect(shouldLiveSyncMissionControl('failed')).toBe(false);
		expect(shouldLiveSyncMissionControl('cancelled')).toBe(false);
		expect(shouldLiveSyncMissionControl('idle')).toBe(false);
		expect(shouldLiveSyncMissionControl(null)).toBe(false);
	});

	it('skips duplicate hydration unless live sync explicitly forces a refresh', () => {
		expect(
			shouldSkipMissionControlHydration({
				missionId: 'mission-1',
				inFlightMissionId: null,
				lastHydratedMissionId: 'mission-1',
				currentMissionId: 'mission-1'
			})
		).toBe(true);

		expect(
			shouldSkipMissionControlHydration({
				missionId: 'mission-1',
				inFlightMissionId: null,
				lastHydratedMissionId: 'mission-1',
				currentMissionId: 'mission-1',
				force: true
			})
		).toBe(false);
	});

	it('still protects against concurrent fetches for the same mission', () => {
		expect(
			shouldSkipMissionControlHydration({
				missionId: 'mission-1',
				inFlightMissionId: 'mission-1',
				lastHydratedMissionId: null,
				currentMissionId: null,
				force: true
			})
		).toBe(true);
	});
});
