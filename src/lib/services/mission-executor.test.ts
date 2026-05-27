import { afterEach, describe, expect, it } from 'vitest';
import { MissionExecutor, type ExecutionProgress, type ExecutionStatus } from './mission-executor';
import { syncClient, type SyncEvent } from './sync-client';

const executors: MissionExecutor[] = [];

function createExecutor(status: ExecutionStatus): { executor: MissionExecutor; statusChanges: ExecutionStatus[] } {
	const executor = new MissionExecutor();
	executors.push(executor);
	const progress = executor.getProgress();
	(executor as unknown as { progress: ExecutionProgress }).progress = {
		...progress,
		status,
		missionId: 'mission-1'
	};
	const statusChanges: ExecutionStatus[] = [];
	executor.setCallbacks({
		onStatusChange: (nextStatus) => statusChanges.push(nextStatus)
	});
	return { executor, statusChanges };
}

function emitServerMissionStarted(): void {
	const event: SyncEvent = {
		type: 'mission_started',
		missionId: 'mission-1',
		data: {},
		timestamp: new Date().toISOString(),
		source: 'server'
	};
	(syncClient as unknown as { handleMessage: (data: Record<string, unknown>) => void }).handleMessage({
		type: 'event',
		event
	});
}

afterEach(() => {
	for (const executor of executors.splice(0)) {
		executor.destroy();
	}
});

describe('MissionExecutor sync state transitions', () => {
	it.each<ExecutionStatus>(['completed', 'failed', 'cancelled'])(
		'keeps %s missions terminal when a stale mission_started event arrives',
		(status) => {
			const { executor, statusChanges } = createExecutor(status);

			emitServerMissionStarted();

			expect(executor.getProgress().status).toBe(status);
			expect(statusChanges).toEqual([]);
		}
	);

	it.each<ExecutionStatus>(['idle', 'creating', 'paused', 'partial'])(
		'allows non-terminal %s missions to become running when mission_started arrives',
		(status) => {
			const { executor, statusChanges } = createExecutor(status);

			emitServerMissionStarted();

			expect(executor.getProgress().status).toBe('running');
			expect(statusChanges).toEqual(['running']);
		}
	);
});
