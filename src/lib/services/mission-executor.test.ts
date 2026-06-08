import { afterEach, describe, expect, it, vi } from 'vitest';
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
	vi.unstubAllGlobals();
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

describe('MissionExecutor dispatch authority boundaries', () => {
	it('does not replay relay authority into provider dispatch', async () => {
		const executor = new MissionExecutor();
		executors.push(executor);
		const progress = executor.getProgress();
		(executor as unknown as { progress: ExecutionProgress }).progress = {
			...progress,
			missionId: 'mission-relay-authority',
			mission: {
				id: 'mission-relay-authority',
				context: { projectPath: 'C:\\tmp\\relay-authority-test' }
			} as ExecutionProgress['mission']
		};
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
			new Response(JSON.stringify({ success: true, sessions: {} }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		vi.stubGlobal('fetch', fetchMock);

		const result = await (executor as unknown as {
			dispatchToProviders: (
				executionPack: Record<string, unknown>,
				options: Record<string, unknown>,
				relay?: Record<string, unknown>
			) => Promise<{ success: boolean }>;
		}).dispatchToProviders(
			{ missionId: 'mission-relay-authority', tasks: [] },
			{ apiKeys: {}, providers: ['codex'] },
			{
				missionId: 'mission-relay-authority',
				requestId: 'request-relay-authority',
				executionAuthority: { schema_version: 'governor-decision-v1' },
				execution_authority: { schema_version: 'governor-decision-v1' }
			}
		);

		expect(result.success).toBe(true);
		const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit];
		const body = JSON.parse(init.body as string);
		expect(body.executionAuthority).toBeUndefined();
		expect(body.relay).toMatchObject({
			missionId: 'mission-relay-authority',
			requestId: 'request-relay-authority'
		});
		expect(body.relay.executionAuthority).toBeUndefined();
		expect(body.relay.execution_authority).toBeUndefined();
	});
});
