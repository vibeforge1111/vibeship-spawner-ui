import { describe, expect, it } from 'vitest';
import { compareMissionControlEntriesByLastUpdatedDescending } from './mission-control-relay';

type Entry = { id: string; lastUpdated?: string | null };

function sortClone(entries: Entry[]): Entry[] {
	return entries.slice().sort(compareMissionControlEntriesByLastUpdatedDescending);
}

describe('compareMissionControlEntriesByLastUpdatedDescending', () => {
	it('orders well-formed ISO timestamps newest-first', () => {
		const entries: Entry[] = [
			{ id: 'older', lastUpdated: '2026-05-31T08:00:00.000Z' },
			{ id: 'newest', lastUpdated: '2026-06-01T12:00:00.000Z' },
			{ id: 'middle', lastUpdated: '2026-05-31T18:00:00.000Z' }
		];
		expect(sortClone(entries).map((entry) => entry.id)).toEqual(['newest', 'middle', 'older']);
	});

	it('pushes entries with an empty lastUpdated to the tail (was NaN-undefined order)', () => {
		const entries: Entry[] = [
			{ id: 'empty', lastUpdated: '' },
			{ id: 'valid', lastUpdated: '2026-06-01T12:00:00.000Z' }
		];
		expect(sortClone(entries).map((entry) => entry.id)).toEqual(['valid', 'empty']);
	});

	it('pushes entries with a malformed lastUpdated to the tail (Date.parse returns NaN)', () => {
		const entries: Entry[] = [
			{ id: 'garbage', lastUpdated: 'not-a-real-date' },
			{ id: 'valid', lastUpdated: '2026-06-01T12:00:00.000Z' },
			{ id: 'null', lastUpdated: null }
		];
		expect(sortClone(entries).map((entry) => entry.id)).toEqual(['valid', 'garbage', 'null']);
	});

	it('preserves a deterministic ordering when every entry has a NaN-producing lastUpdated', () => {
		const entries: Entry[] = [
			{ id: 'a', lastUpdated: '' },
			{ id: 'b', lastUpdated: 'totally-bogus' },
			{ id: 'c', lastUpdated: null }
		];
		// All three compare equal under the new comparator; the previous
		// `Date.parse(b) - Date.parse(a)` returned NaN here, which makes
		// Array.sort behavior undefined. The new comparator returns 0 so the
		// engine's stable-sort guarantee keeps insertion order.
		expect(sortClone(entries).map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
	});

	it('keeps a NaN entry from "winning" the newest slot against a valid one', () => {
		const entries: Entry[] = [
			{ id: 'valid', lastUpdated: '2026-06-01T12:00:00.000Z' },
			{ id: 'garbage', lastUpdated: 'still-bogus' }
		];
		const sorted = sortClone(entries);
		expect(sorted[0].id).toBe('valid');
		expect(sorted[1].id).toBe('garbage');
	});
});
