/**
 * Timeline Recorder - Records and replays execution events
 *
 * Features:
 * - Records all events with timestamps
 * - Supports playback at variable speeds
 * - Allows scrubbing to any point in time
 * - Persists timeline for session review
 */

import { writable, derived, get } from 'svelte/store';
import type { SpawnerLiveEvent } from '../types';
import { eventRouter } from '../orchestrator';

export interface TimelineEvent {
	id: string;
	event: SpawnerLiveEvent;
	timestamp: number; // Absolute timestamp
	relativeTime: number; // Time since start (ms)
}

export interface TimelineState {
	events: TimelineEvent[];
	startTime: number | null;
	endTime: number | null;
	duration: number;
	isRecording: boolean;
	isPlaying: boolean;
	isPaused: boolean;
	currentTime: number; // Current playback position (ms from start)
	playbackSpeed: number; // 0.5x, 1x, 2x, etc.
}

export interface TimelineMarker {
	id: string;
	time: number; // Relative time from start
	label: string;
	type: 'milestone' | 'error' | 'deviation' | 'custom';
	nodeId?: string;
}

const initialState: TimelineState = {
	events: [],
	startTime: null,
	endTime: null,
	duration: 0,
	isRecording: false,
	isPlaying: false,
	isPaused: false,
	currentTime: 0,
	playbackSpeed: 1
};

class TimelineRecorder {
	public state = writable<TimelineState>(initialState);
	public markers = writable<TimelineMarker[]>([]);

	private eventCounter = 0;
	private markerCounter = 0;
	private playbackTimer: ReturnType<typeof setInterval> | null = null;
	private lastPlaybackUpdate = 0;
	private unsubscribeRouter: (() => void) | null = null;

	// Derived stores for convenience
	public events = derived(this.state, ($state) => $state.events);
	public isRecording = derived(this.state, ($state) => $state.isRecording);
	public isPlaying = derived(this.state, ($state) => $state.isPlaying);
	public duration = derived(this.state, ($state) => $state.duration);
	public currentTime = derived(this.state, ($state) => $state.currentTime);
	public progress = derived(this.state, ($state) =>
		$state.duration > 0 ? $state.currentTime / $state.duration : 0
	);

	// Get events up to current playback time
	public visibleEvents = derived(this.state, ($state) =>
		$state.events.filter((e) => e.relativeTime <= $state.currentTime)
	);

	/**
	 * Start recording events
	 */
	startRecording(): void {
		const state = get(this.state);
		if (state.isRecording) return;

		// Clear previous recording
		this.clear();

		const startTime = Date.now();

		this.state.update((s) => ({
			...s,
			isRecording: true,
			startTime,
			endTime: null,
			duration: 0,
			currentTime: 0
		}));

		// Subscribe to event router
		this.unsubscribeRouter = eventRouter.subscribe((event) => {
			this.recordEvent(event);
		});

		console.log('[TimelineRecorder] Recording started');
	}

	/**
	 * Stop recording events
	 */
	stopRecording(): void {
		const state = get(this.state);
		if (!state.isRecording) return;

		// Unsubscribe from event router
		if (this.unsubscribeRouter) {
			this.unsubscribeRouter();
			this.unsubscribeRouter = null;
		}

		const endTime = Date.now();
		const duration = state.startTime ? endTime - state.startTime : 0;

		this.state.update((s) => ({
			...s,
			isRecording: false,
			endTime,
			duration,
			currentTime: duration // Move to end
		}));

		console.log(`[TimelineRecorder] Recording stopped. Duration: ${duration}ms, Events: ${state.events.length}`);
	}

	/**
	 * Record a single event
	 */
	private recordEvent(event: SpawnerLiveEvent): void {
		const state = get(this.state);
		if (!state.isRecording || !state.startTime) return;

		const timestamp = event.timestamp || Date.now();
		const relativeTime = timestamp - state.startTime;

		const timelineEvent: TimelineEvent = {
			id: `event-${++this.eventCounter}`,
			event,
			timestamp,
			relativeTime
		};

		this.state.update((s) => ({
			...s,
			events: [...s.events, timelineEvent],
			duration: Math.max(s.duration, relativeTime),
			currentTime: relativeTime // Keep current time at latest event
		}));

		// Auto-add markers for significant events
		this.autoAddMarker(event, relativeTime);
	}

	/**
	 * Automatically add markers for significant events
	 */
	private autoAddMarker(event: SpawnerLiveEvent, time: number): void {
		let marker: TimelineMarker | null = null;

		switch (event.type) {
			case 'pipeline_start':
				marker = {
					id: `marker-${++this.markerCounter}`,
					time,
					label: 'Pipeline Started',
					type: 'milestone'
				};
				break;
			case 'pipeline_complete':
				marker = {
					id: `marker-${++this.markerCounter}`,
					time,
					label: 'Pipeline Complete',
					type: 'milestone'
				};
				break;
			case 'agent_error':
				marker = {
					id: `marker-${++this.markerCounter}`,
					time,
					label: `Error: ${event.metadata?.error || 'Unknown'}`,
					type: 'error',
					nodeId: event.nodeId
				};
				break;
			case 'deviation':
				marker = {
					id: `marker-${++this.markerCounter}`,
					time,
					label: `Deviation: ${event.metadata?.reason || 'Path change'}`,
					type: 'deviation',
					nodeId: event.nodeId
				};
				break;
		}

		if (marker) {
			this.markers.update((markers) => [...markers, marker!]);
		}
	}

	/**
	 * Add a custom marker at current time
	 */
	addMarker(label: string, type: TimelineMarker['type'] = 'custom'): void {
		const state = get(this.state);

		const marker: TimelineMarker = {
			id: `marker-${++this.markerCounter}`,
			time: state.currentTime,
			label,
			type
		};

		this.markers.update((markers) => [...markers, marker]);
	}

	/**
	 * Start playback from current position
	 */
	play(): void {
		const state = get(this.state);
		if (state.isPlaying || state.events.length === 0) return;

		// If at end, restart from beginning
		if (state.currentTime >= state.duration) {
			this.seek(0);
		}

		this.state.update((s) => ({
			...s,
			isPlaying: true,
			isPaused: false
		}));

		this.lastPlaybackUpdate = Date.now();

		// Start playback timer (60fps)
		this.playbackTimer = setInterval(() => {
			this.updatePlayback();
		}, 1000 / 60);

		console.log('[TimelineRecorder] Playback started');
	}

	/**
	 * Pause playback
	 */
	pause(): void {
		const state = get(this.state);
		if (!state.isPlaying) return;

		if (this.playbackTimer) {
			clearInterval(this.playbackTimer);
			this.playbackTimer = null;
		}

		this.state.update((s) => ({
			...s,
			isPlaying: false,
			isPaused: true
		}));

		console.log('[TimelineRecorder] Playback paused');
	}

	/**
	 * Stop playback and reset to beginning
	 */
	stop(): void {
		if (this.playbackTimer) {
			clearInterval(this.playbackTimer);
			this.playbackTimer = null;
		}

		this.state.update((s) => ({
			...s,
			isPlaying: false,
			isPaused: false,
			currentTime: 0
		}));

		console.log('[TimelineRecorder] Playback stopped');
	}

	/**
	 * Seek to a specific time
	 */
	seek(time: number): void {
		const state = get(this.state);
		const clampedTime = Math.max(0, Math.min(time, state.duration));

		this.state.update((s) => ({
			...s,
			currentTime: clampedTime
		}));

		// Replay events up to this point
		this.replayEventsTo(clampedTime);
	}

	/**
	 * Seek to a percentage (0-1)
	 */
	seekPercent(percent: number): void {
		const state = get(this.state);
		const time = percent * state.duration;
		this.seek(time);
	}

	/**
	 * Set playback speed
	 */
	setSpeed(speed: number): void {
		const clampedSpeed = Math.max(0.25, Math.min(4, speed));

		this.state.update((s) => ({
			...s,
			playbackSpeed: clampedSpeed
		}));
	}

	/**
	 * Skip forward/backward by amount
	 */
	skip(ms: number): void {
		const state = get(this.state);
		this.seek(state.currentTime + ms);
	}

	/**
	 * Jump to next marker
	 */
	nextMarker(): void {
		const state = get(this.state);
		const markers = get(this.markers);

		const nextMarker = markers.find((m) => m.time > state.currentTime);
		if (nextMarker) {
			this.seek(nextMarker.time);
		}
	}

	/**
	 * Jump to previous marker
	 */
	prevMarker(): void {
		const state = get(this.state);
		const markers = get(this.markers);

		const prevMarkers = markers.filter((m) => m.time < state.currentTime);
		if (prevMarkers.length > 0) {
			this.seek(prevMarkers[prevMarkers.length - 1].time);
		}
	}

	/**
	 * Update playback position
	 */
	private updatePlayback(): void {
		const state = get(this.state);
		if (!state.isPlaying) return;

		const now = Date.now();
		const delta = (now - this.lastPlaybackUpdate) * state.playbackSpeed;
		this.lastPlaybackUpdate = now;

		const newTime = state.currentTime + delta;

		if (newTime >= state.duration) {
			// Reached end
			this.state.update((s) => ({
				...s,
				currentTime: s.duration,
				isPlaying: false,
				isPaused: false
			}));

			if (this.playbackTimer) {
				clearInterval(this.playbackTimer);
				this.playbackTimer = null;
			}

			console.log('[TimelineRecorder] Playback complete');
			return;
		}

		this.state.update((s) => ({
			...s,
			currentTime: newTime
		}));

		// Emit events that fall within the last frame
		this.emitEventsInRange(state.currentTime, newTime);
	}

	/**
	 * Emit events that occurred within a time range (for playback)
	 */
	private emitEventsInRange(fromTime: number, toTime: number): void {
		const state = get(this.state);

		const eventsInRange = state.events.filter(
			(e) => e.relativeTime > fromTime && e.relativeTime <= toTime
		);

		for (const timelineEvent of eventsInRange) {
			// Dispatch the event to trigger visual effects
			eventRouter.dispatch(timelineEvent.event);
		}
	}

	/**
	 * Replay all events up to a specific time (for seeking)
	 */
	private replayEventsTo(time: number): void {
		const state = get(this.state);

		// Filter events up to the target time
		const eventsToReplay = state.events.filter((e) => e.relativeTime <= time);

		// For seeking, we want to show the final state, not animate
		// We'll just emit the latest state-changing events for each node
		const latestByNode = new Map<string, TimelineEvent>();

		for (const event of eventsToReplay) {
			if (event.event.nodeId) {
				latestByNode.set(event.event.nodeId, event);
			}
		}

		// Emit only the latest state for each node
		for (const [_, timelineEvent] of latestByNode) {
			// We could dispatch these, but for now we just update visible events
			// The UI will react to the visibleEvents derived store
		}
	}

	/**
	 * Clear the timeline
	 */
	clear(): void {
		if (this.playbackTimer) {
			clearInterval(this.playbackTimer);
			this.playbackTimer = null;
		}

		if (this.unsubscribeRouter) {
			this.unsubscribeRouter();
			this.unsubscribeRouter = null;
		}

		this.state.set(initialState);
		this.markers.set([]);
		this.eventCounter = 0;
		this.markerCounter = 0;

		console.log('[TimelineRecorder] Timeline cleared');
	}

	/**
	 * Export timeline as JSON
	 */
	export(): string {
		const state = get(this.state);
		const markers = get(this.markers);

		return JSON.stringify(
			{
				version: 1,
				exportedAt: Date.now(),
				state: {
					events: state.events,
					startTime: state.startTime,
					endTime: state.endTime,
					duration: state.duration
				},
				markers
			},
			null,
			2
		);
	}

	/**
	 * Import timeline from JSON
	 */
	import(json: string): boolean {
		try {
			const data = JSON.parse(json);

			if (data.version !== 1) {
				console.error('[TimelineRecorder] Unsupported timeline version');
				return false;
			}

			this.clear();

			this.state.update((s) => ({
				...s,
				events: data.state.events,
				startTime: data.state.startTime,
				endTime: data.state.endTime,
				duration: data.state.duration,
				currentTime: 0
			}));

			this.markers.set(data.markers);
			this.eventCounter = data.state.events.length;
			this.markerCounter = data.markers.length;

			console.log(`[TimelineRecorder] Imported timeline with ${data.state.events.length} events`);
			return true;
		} catch (error) {
			console.error('[TimelineRecorder] Failed to import timeline:', error);
			return false;
		}
	}

	/**
	 * Get statistics about the timeline
	 */
	getStats(): {
		totalEvents: number;
		eventsByType: Record<string, number>;
		duration: number;
		nodesInvolved: string[];
	} {
		const state = get(this.state);

		const eventsByType: Record<string, number> = {};
		const nodesSet = new Set<string>();

		for (const event of state.events) {
			eventsByType[event.event.type] = (eventsByType[event.event.type] || 0) + 1;
			if (event.event.nodeId) {
				nodesSet.add(event.event.nodeId);
			}
		}

		return {
			totalEvents: state.events.length,
			eventsByType,
			duration: state.duration,
			nodesInvolved: Array.from(nodesSet)
		};
	}

	/**
	 * Destroy the recorder
	 */
	destroy(): void {
		this.clear();
	}
}

export const timelineRecorder = new TimelineRecorder();
export { TimelineRecorder };
