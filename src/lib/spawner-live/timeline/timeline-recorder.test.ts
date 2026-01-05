import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';

// Mock the event router before importing timeline recorder
vi.mock('../orchestrator', () => ({
	eventRouter: {
		dispatch: vi.fn(),
		subscribe: vi.fn((callback) => {
			// Store the callback for later use in tests
			(global as any).__eventRouterCallback = callback;
			return () => {
				(global as any).__eventRouterCallback = null;
			};
		})
	}
}));

import { timelineRecorder } from './timeline-recorder';

// Helper to simulate event dispatch
function simulateEvent(event: any) {
	const callback = (global as any).__eventRouterCallback;
	if (callback) {
		callback(event);
	}
}

describe('TimelineRecorder', () => {
	beforeEach(() => {
		timelineRecorder.clear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		timelineRecorder.stopRecording();
		timelineRecorder.stop();
		vi.useRealTimers();
	});

	describe('recording', () => {
		it('should start recording', () => {
			timelineRecorder.startRecording();
			const state = get(timelineRecorder.state);
			expect(state.isRecording).toBe(true);
			expect(state.startTime).not.toBeNull();
		});

		it('should stop recording', () => {
			timelineRecorder.startRecording();
			timelineRecorder.stopRecording();
			const state = get(timelineRecorder.state);
			expect(state.isRecording).toBe(false);
			expect(state.endTime).not.toBeNull();
		});

		it('should record events via event router subscription', () => {
			timelineRecorder.startRecording();

			// Simulate an event being dispatched through the router
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});

			const state = get(timelineRecorder.state);
			expect(state.events.length).toBe(1);
			expect(state.events[0].event.type).toBe('agent_enter');
			expect(state.events[0].event.nodeId).toBe('node-1');
		});

		it('should not record events when not recording', () => {
			// Don't start recording
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});

			const state = get(timelineRecorder.state);
			expect(state.events.length).toBe(0);
		});

		it('should calculate relative time correctly', () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			timelineRecorder.startRecording();

			// Advance time by 1000ms
			vi.advanceTimersByTime(1000);

			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});

			const state = get(timelineRecorder.state);
			expect(state.events.length).toBe(1);
			expect(state.events[0].relativeTime).toBe(1000);
		});
	});

	describe('playback', () => {
		it('should play recorded events', () => {
			// Record some events
			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			timelineRecorder.stopRecording();

			// Start playback
			timelineRecorder.play();
			const state = get(timelineRecorder.state);
			expect(state.isPlaying).toBe(true);
		});

		it('should pause playback', () => {
			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			timelineRecorder.stopRecording();

			timelineRecorder.play();
			timelineRecorder.pause();

			const state = get(timelineRecorder.state);
			expect(state.isPlaying).toBe(false);
			expect(state.isPaused).toBe(true);
		});

		it('should stop playback', () => {
			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			timelineRecorder.stopRecording();

			timelineRecorder.play();
			timelineRecorder.stop();

			const state = get(timelineRecorder.state);
			expect(state.isPlaying).toBe(false);
			expect(state.isPaused).toBe(false);
			expect(state.currentTime).toBe(0);
		});

		it('should seek to a specific time', () => {
			const startTime = Date.now();
			vi.setSystemTime(startTime);

			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			vi.advanceTimersByTime(5000);
			timelineRecorder.stopRecording();

			timelineRecorder.seek(2500);

			const state = get(timelineRecorder.state);
			expect(state.currentTime).toBe(2500);
		});

		it('should change playback speed', () => {
			timelineRecorder.setSpeed(2);
			const state = get(timelineRecorder.state);
			expect(state.playbackSpeed).toBe(2);
		});

		it('should clamp playback speed', () => {
			timelineRecorder.setSpeed(10);
			expect(get(timelineRecorder.state).playbackSpeed).toBe(4);

			timelineRecorder.setSpeed(0.1);
			expect(get(timelineRecorder.state).playbackSpeed).toBe(0.25);
		});
	});

	describe('markers', () => {
		it('should add markers', () => {
			timelineRecorder.startRecording();
			timelineRecorder.addMarker('Test Marker', 'custom');

			const markers = get(timelineRecorder.markers);
			expect(markers.length).toBe(1);
			expect(markers[0].label).toBe('Test Marker');
			expect(markers[0].type).toBe('custom');
		});

		it('should auto-add markers for pipeline events', () => {
			timelineRecorder.startRecording();

			simulateEvent({
				type: 'pipeline_start',
				nodeId: 'pipeline',
				timestamp: Date.now()
			});

			const markers = get(timelineRecorder.markers);
			expect(markers.length).toBe(1);
			expect(markers[0].label).toBe('Pipeline Started');
			expect(markers[0].type).toBe('milestone');
		});

		it('should clear markers on clear', () => {
			timelineRecorder.startRecording();
			timelineRecorder.addMarker('Test Marker', 'custom');
			timelineRecorder.clear();

			const markers = get(timelineRecorder.markers);
			expect(markers.length).toBe(0);
		});
	});

	describe('clear', () => {
		it('should reset all state', () => {
			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			timelineRecorder.addMarker('Test', 'custom');
			timelineRecorder.stopRecording();

			timelineRecorder.clear();

			const state = get(timelineRecorder.state);
			expect(state.events.length).toBe(0);
			expect(state.isRecording).toBe(false);
			expect(state.isPlaying).toBe(false);
			expect(state.startTime).toBeNull();
			expect(state.endTime).toBeNull();
		});
	});

	describe('export/import', () => {
		it('should export timeline as JSON', () => {
			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			timelineRecorder.stopRecording();

			const exported = timelineRecorder.export();
			const parsed = JSON.parse(exported);

			expect(parsed.version).toBe(1);
			expect(parsed.state.events.length).toBe(1);
		});

		it('should import timeline from JSON', () => {
			const json = JSON.stringify({
				version: 1,
				exportedAt: Date.now(),
				state: {
					events: [
						{
							id: 'event-1',
							event: { type: 'agent_enter', nodeId: 'node-1', timestamp: Date.now() },
							timestamp: Date.now(),
							relativeTime: 0
						}
					],
					startTime: Date.now(),
					endTime: Date.now() + 1000,
					duration: 1000
				},
				markers: []
			});

			const result = timelineRecorder.import(json);

			expect(result).toBe(true);
			const state = get(timelineRecorder.state);
			expect(state.events.length).toBe(1);
			expect(state.duration).toBe(1000);
		});
	});

	describe('statistics', () => {
		it('should get timeline statistics', () => {
			timelineRecorder.startRecording();
			simulateEvent({
				type: 'agent_enter',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			simulateEvent({
				type: 'agent_exit',
				nodeId: 'node-1',
				timestamp: Date.now()
			});
			timelineRecorder.stopRecording();

			const stats = timelineRecorder.getStats();

			expect(stats.totalEvents).toBe(2);
			expect(stats.eventsByType['agent_enter']).toBe(1);
			expect(stats.eventsByType['agent_exit']).toBe(1);
			expect(stats.nodesInvolved).toContain('node-1');
		});
	});
});
