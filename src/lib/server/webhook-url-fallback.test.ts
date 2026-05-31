import { describe, it, expect } from 'vitest';
import {
	selectWebhookUrlsForMissionEvent,
	type MissionControlBridgeEvent
} from './mission-control-relay';

const ALL_URLS = ['http://localhost:3001', 'http://localhost:3002'];

describe('selectWebhookUrlsForMissionEvent - fallback logic', () => {
	it('falls back to all webhooks when no match found', () => {
		const event: MissionControlBridgeEvent = {};
		expect(selectWebhookUrlsForMissionEvent(event, ALL_URLS)).toEqual(ALL_URLS);
	});

	it('returns matched subset when telegramRelay url matches exactly', () => {
		const event: MissionControlBridgeEvent = {
			data: { telegramRelay: { url: 'http://localhost:3001' } }
		};
		expect(selectWebhookUrlsForMissionEvent(event, ALL_URLS)).toEqual(['http://localhost:3001']);
	});

	it('handles empty all-webhooks list without throw', () => {
		const event: MissionControlBridgeEvent = {};
		expect(() => selectWebhookUrlsForMissionEvent(event, [])).not.toThrow();
	});

	it('handles malformed relay data without throw', () => {
		const event: MissionControlBridgeEvent = { data: null as unknown as Record<string, unknown> };
		expect(() => selectWebhookUrlsForMissionEvent(event, [])).not.toThrow();
	});

	it('fallback result length bounded by all-webhooks', () => {
		const event: MissionControlBridgeEvent = {};
		const result = selectWebhookUrlsForMissionEvent(event, ALL_URLS);
		expect(result.length).toBeLessThanOrEqual(ALL_URLS.length);
	});

	it('does not introduce urls beyond the provided set', () => {
		const event: MissionControlBridgeEvent = {};
		const result = selectWebhookUrlsForMissionEvent(event, ALL_URLS);
		expect(result.every((u) => ALL_URLS.includes(u))).toBe(true);
	});
});
