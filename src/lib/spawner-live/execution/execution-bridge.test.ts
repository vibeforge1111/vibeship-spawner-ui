import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionBridge } from './execution-bridge';

// Mock the dependencies
vi.mock('../orchestrator', () => ({
	eventRouter: {
		dispatch: vi.fn()
	}
}));

vi.mock('../timeline', () => ({
	timelineRecorder: {
		startRecording: vi.fn(),
		stopRecording: vi.fn()
	}
}));

vi.mock('../audio', () => ({
	soundManager: {
		play: vi.fn()
	}
}));

vi.mock('../stores', () => ({
	liveModeStore: {
		subscribe: vi.fn((fn) => {
			fn({ enabled: true });
			return () => {};
		})
	}
}));

vi.mock('svelte/store', () => ({
	get: vi.fn(() => ({ enabled: true }))
}));

describe('ExecutionBridge', () => {
	let bridge: ExecutionBridge;
	let mockCallbacks: any;
	let nodeMap: Map<string, { id: string; name: string }>;

	beforeEach(() => {
		vi.clearAllMocks();
		bridge = new ExecutionBridge();

		mockCallbacks = {
			onStatusChange: vi.fn(),
			onProgress: vi.fn(),
			onLog: vi.fn(),
			onTaskStart: vi.fn(),
			onTaskComplete: vi.fn(),
			onComplete: vi.fn(),
			onError: vi.fn()
		};

		nodeMap = new Map([
			['node-1', { id: 'node-1', name: 'Task 1' }],
			['node-2', { id: 'node-2', name: 'Task 2' }]
		]);
	});

	describe('wrapCallbacks', () => {
		it('should return wrapped callbacks when live mode is enabled', () => {
			const wrapped = bridge.wrapCallbacks(mockCallbacks, nodeMap);

			expect(wrapped.onStatusChange).toBeDefined();
			expect(wrapped.onProgress).toBeDefined();
			expect(wrapped.onLog).toBeDefined();
			expect(wrapped.onTaskStart).toBeDefined();
			expect(wrapped.onTaskComplete).toBeDefined();
			expect(wrapped.onComplete).toBeDefined();
			expect(wrapped.onError).toBeDefined();
		});

		it('should call original callbacks', () => {
			const wrapped = bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-1');

			wrapped.onStatusChange?.('running');
			expect(mockCallbacks.onStatusChange).toHaveBeenCalledWith('running');

			wrapped.onProgress?.(50);
			expect(mockCallbacks.onProgress).toHaveBeenCalledWith(50);

			wrapped.onTaskStart?.('node-1', 'Task 1');
			expect(mockCallbacks.onTaskStart).toHaveBeenCalledWith('node-1', 'Task 1');

			wrapped.onTaskComplete?.('node-1', true);
			expect(mockCallbacks.onTaskComplete).toHaveBeenCalledWith('node-1', true);
		});
	});

	describe('activate/deactivate', () => {
		it('should activate the bridge', async () => {
			const { eventRouter } = await import('../orchestrator');
			const { soundManager } = await import('../audio');
			const { timelineRecorder } = await import('../timeline');

			bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-123');

			expect(timelineRecorder.startRecording).toHaveBeenCalled();
			expect(eventRouter.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'pipeline_start',
					nodeId: 'pipeline'
				})
			);
			expect(soundManager.play).toHaveBeenCalledWith('start');
		});

		it('should deactivate the bridge', async () => {
			const { timelineRecorder } = await import('../timeline');

			bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-123');
			bridge.deactivate();

			expect(timelineRecorder.stopRecording).toHaveBeenCalled();
		});
	});

	describe('event handling', () => {
		it('should dispatch events on task start', async () => {
			const { eventRouter } = await import('../orchestrator');
			const { soundManager } = await import('../audio');

			const wrapped = bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-123');

			vi.clearAllMocks();
			wrapped.onTaskStart?.('node-1', 'Task 1');

			expect(eventRouter.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'agent_enter',
					nodeId: 'node-1',
					agentId: 'Task 1'
				})
			);
			expect(soundManager.play).toHaveBeenCalledWith('nodeActivate');
		});

		it('should dispatch events on task complete success', async () => {
			const { eventRouter } = await import('../orchestrator');
			const { soundManager } = await import('../audio');

			const wrapped = bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-123');

			vi.clearAllMocks();
			wrapped.onTaskComplete?.('node-1', true);

			expect(eventRouter.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'agent_exit',
					nodeId: 'node-1'
				})
			);
			expect(eventRouter.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'node_complete',
					nodeId: 'node-1'
				})
			);
			expect(soundManager.play).toHaveBeenCalledWith('nodeComplete');
		});

		it('should dispatch error events on task failure', async () => {
			const { eventRouter } = await import('../orchestrator');
			const { soundManager } = await import('../audio');

			const wrapped = bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-123');

			vi.clearAllMocks();
			wrapped.onTaskComplete?.('node-1', false);

			expect(eventRouter.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'agent_error',
					nodeId: 'node-1'
				})
			);
			expect(soundManager.play).toHaveBeenCalledWith('error');
		});

		it('should dispatch pipeline complete event', async () => {
			const { eventRouter } = await import('../orchestrator');
			const { soundManager } = await import('../audio');

			const wrapped = bridge.wrapCallbacks(mockCallbacks, nodeMap);
			bridge.activate('mission-123');

			vi.clearAllMocks();
			wrapped.onComplete?.({ id: 'mission-123' });

			expect(eventRouter.dispatch).toHaveBeenCalledWith(
				expect.objectContaining({
					type: 'pipeline_complete',
					nodeId: 'pipeline'
				})
			);
			expect(soundManager.play).toHaveBeenCalledWith('success');
		});
	});
});
