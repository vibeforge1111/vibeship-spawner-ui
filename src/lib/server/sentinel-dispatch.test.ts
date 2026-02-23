import { describe, expect, it } from 'vitest';
import {
	normalizeSentinelDispatchPayload,
	type SentinelDispatchPayload,
	validateSentinelDispatchPayload
} from './sentinel-dispatch';

describe('sentinel-dispatch', () => {
	it('accepts valid payloads', () => {
		const payload: SentinelDispatchPayload = {
			source: 'spark-pr-sentinel',
			generated_at: '2026-02-23T00:00:00Z',
			summary: { open_prs: 1 },
			actions: [
				{
					kind: 'pr_review',
					id: 'pr#1',
					priority: 'P0_SECURITY',
					title: 'Fix auth issue',
					reasons: ['Auth surface changed']
				}
			]
		};

		expect(validateSentinelDispatchPayload(payload)).toEqual([]);
		const normalized = normalizeSentinelDispatchPayload(payload);
		expect(normalized.actions[0].id).toBe('pr#1');
	});

	it('rejects malformed payloads', () => {
		const bad = {
			source: 'other',
			generated_at: '',
			summary: [],
			actions: [{ kind: 'unknown' }]
		};

		const errors = validateSentinelDispatchPayload(bad);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.join(' ')).toContain('source must be');
	});
});
