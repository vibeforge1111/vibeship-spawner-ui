import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./agent-event-ledger', () => ({}));

describe('scheduler error handling', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('startScheduler does not throw on initial tick', async () => {
		const { startScheduler, stopScheduler } = await import('./scheduler');

		expect(() => startScheduler()).not.toThrow();
		await vi.runAllTimersAsync();
		stopScheduler();
	});

	it('scheduler survives recurring ticks without crashing', async () => {
		const { startScheduler, stopScheduler } = await import('./scheduler');

		startScheduler();
		await vi.advanceTimersByTimeAsync(60_000);
		stopScheduler();
		// If we got here without throwing, the scheduler survived recurring ticks
	});

	it('stopScheduler is safe to call multiple times', async () => {
		const { startScheduler, stopScheduler } = await import('./scheduler');

		startScheduler();
		await vi.advanceTimersByTimeAsync(100);
		stopScheduler();
		expect(() => stopScheduler()).not.toThrow();
	});
});
