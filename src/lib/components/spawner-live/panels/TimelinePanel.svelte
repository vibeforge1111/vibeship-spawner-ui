<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		timelineRecorder,
		type TimelineMarker
	} from '$lib/spawner-live';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	// State from recorder
	let events = $state<any[]>([]);
	let markers = $state<TimelineMarker[]>([]);
	let isRecording = $state(false);
	let isPlaying = $state(false);
	let isPaused = $state(false);
	let duration = $state(0);
	let currentTime = $state(0);
	let playbackSpeed = $state(1);

	// Local UI state
	let showEventList = $state(false);
	let eventFilter = $state<string>('all');
	let scrubberDragging = $state(false);

	// Format time for display
	function formatTime(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		const remainingMs = Math.floor((ms % 1000) / 10);

		if (minutes > 0) {
			return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${remainingMs.toString().padStart(2, '0')}`;
		}
		return `${remainingSeconds}.${remainingMs.toString().padStart(2, '0')}s`;
	}

	// Subscribe to timeline state
	onMount(() => {
		const unsubState = timelineRecorder.state.subscribe((state) => {
			events = state.events;
			isRecording = state.isRecording;
			isPlaying = state.isPlaying;
			isPaused = state.isPaused;
			duration = state.duration;
			currentTime = state.currentTime;
			playbackSpeed = state.playbackSpeed;
		});

		const unsubMarkers = timelineRecorder.markers.subscribe((m) => {
			markers = m;
		});

		return () => {
			unsubState();
			unsubMarkers();
		};
	});

	// Playback controls
	function handleRecord() {
		if (isRecording) {
			timelineRecorder.stopRecording();
		} else {
			timelineRecorder.startRecording();
		}
	}

	function handlePlayPause() {
		if (isPlaying) {
			timelineRecorder.pause();
		} else {
			timelineRecorder.play();
		}
	}

	function handleStop() {
		timelineRecorder.stop();
	}

	function handleClear() {
		timelineRecorder.clear();
	}

	// Speed controls
	const speeds = [0.25, 0.5, 1, 2, 4];

	function cycleSpeed() {
		const currentIndex = speeds.indexOf(playbackSpeed);
		const nextIndex = (currentIndex + 1) % speeds.length;
		timelineRecorder.setSpeed(speeds[nextIndex]);
	}

	// Scrubber controls
	function handleScrubberClick(e: MouseEvent) {
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		timelineRecorder.seekPercent(Math.max(0, Math.min(1, percent)));
	}

	function handleScrubberDrag(e: MouseEvent) {
		if (!scrubberDragging) return;
		const target = (e.currentTarget as HTMLElement).closest('.scrubber-track') as HTMLElement;
		if (!target) return;
		const rect = target.getBoundingClientRect();
		const percent = (e.clientX - rect.left) / rect.width;
		timelineRecorder.seekPercent(Math.max(0, Math.min(1, percent)));
	}

	function startScrubberDrag() {
		scrubberDragging = true;
	}

	function stopScrubberDrag() {
		scrubberDragging = false;
	}

	// Marker navigation
	function handlePrevMarker() {
		timelineRecorder.prevMarker();
	}

	function handleNextMarker() {
		timelineRecorder.nextMarker();
	}

	// Skip controls
	function handleSkipBack() {
		timelineRecorder.skip(-5000);
	}

	function handleSkipForward() {
		timelineRecorder.skip(5000);
	}

	// Filter events
	const filteredEvents = $derived(() => {
		if (eventFilter === 'all') return events;
		return events.filter((e) => e.event.type === eventFilter);
	});

	// Get unique event types for filter
	const eventTypes = $derived(() => {
		const types = new Set(events.map((e) => e.event.type));
		return Array.from(types).sort();
	});

	// Get marker position as percentage
	function getMarkerPosition(marker: TimelineMarker): number {
		if (duration === 0) return 0;
		return (marker.time / duration) * 100;
	}

	// Get marker color based on type
	function getMarkerColor(type: TimelineMarker['type']): string {
		switch (type) {
			case 'milestone':
				return 'var(--accent-primary)';
			case 'error':
				return '#ef4444';
			case 'deviation':
				return '#f59e0b';
			default:
				return '#8b5cf6';
		}
	}

	// Export timeline
	function handleExport() {
		const json = timelineRecorder.export();
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `timeline-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Get stats
	const stats = $derived(() => timelineRecorder.getStats());
</script>

<svelte:window
	onmouseup={stopScrubberDrag}
	onmousemove={handleScrubberDrag}
/>

<div class="timeline-panel">
	<div class="panel-header">
		<h3>Timeline</h3>
		<div class="header-actions">
			{#if events.length > 0}
				<button class="icon-btn" onclick={handleExport} title="Export timeline">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
					</svg>
				</button>
			{/if}
			{#if onClose}
				<button class="icon-btn" onclick={onClose}>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			{/if}
		</div>
	</div>

	<div class="panel-content">
		<!-- Transport controls -->
		<div class="transport-controls">
			<!-- Record button -->
			<button
				class="transport-btn"
				class:recording={isRecording}
				onclick={handleRecord}
				title={isRecording ? 'Stop Recording' : 'Start Recording'}
			>
				{#if isRecording}
					<span class="record-indicator"></span>
				{:else}
					<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
						<circle cx="12" cy="12" r="8" />
					</svg>
				{/if}
			</button>

			<div class="transport-divider"></div>

			<!-- Skip back -->
			<button class="transport-btn" onclick={handleSkipBack} disabled={duration === 0} title="Skip back 5s">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
				</svg>
			</button>

			<!-- Previous marker -->
			<button class="transport-btn" onclick={handlePrevMarker} disabled={markers.length === 0} title="Previous marker">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
				</svg>
			</button>

			<!-- Play/Pause -->
			<button
				class="transport-btn play-btn"
				onclick={handlePlayPause}
				disabled={duration === 0}
				title={isPlaying ? 'Pause' : 'Play'}
			>
				{#if isPlaying}
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
					</svg>
				{:else}
					<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M8 5v14l11-7z" />
					</svg>
				{/if}
			</button>

			<!-- Stop -->
			<button class="transport-btn" onclick={handleStop} disabled={!isPlaying && !isPaused} title="Stop">
				<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
					<rect x="6" y="6" width="12" height="12" />
				</svg>
			</button>

			<!-- Next marker -->
			<button class="transport-btn" onclick={handleNextMarker} disabled={markers.length === 0} title="Next marker">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
				</svg>
			</button>

			<!-- Skip forward -->
			<button class="transport-btn" onclick={handleSkipForward} disabled={duration === 0} title="Skip forward 5s">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
				</svg>
			</button>

			<div class="transport-divider"></div>

			<!-- Speed control -->
			<button class="speed-btn" onclick={cycleSpeed} title="Playback speed">
				{playbackSpeed}x
			</button>
		</div>

		<!-- Scrubber -->
		<div class="scrubber">
			<span class="time-display">{formatTime(currentTime)}</span>
			<div
				class="scrubber-track"
				onclick={handleScrubberClick}
				onmousedown={startScrubberDrag}
				role="slider"
				aria-label="Timeline scrubber"
				aria-valuenow={currentTime}
				aria-valuemin={0}
				aria-valuemax={duration}
				tabindex="0"
			>
				<!-- Progress bar -->
				<div
					class="scrubber-progress"
					style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
				></div>

				<!-- Markers -->
				{#each markers as marker}
					<div
						class="scrubber-marker"
						style="left: {getMarkerPosition(marker)}%; background-color: {getMarkerColor(marker.type)}"
						title={marker.label}
					></div>
				{/each}

				<!-- Playhead -->
				<div
					class="scrubber-playhead"
					style="left: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
				></div>
			</div>
			<span class="time-display">{formatTime(duration)}</span>
		</div>

		<!-- Stats row -->
		<div class="stats-row">
			<span class="stat">
				<span class="stat-value">{events.length}</span>
				<span class="stat-label">events</span>
			</span>
			<span class="stat">
				<span class="stat-value">{markers.length}</span>
				<span class="stat-label">markers</span>
			</span>
			<span class="stat">
				<span class="stat-value">{stats().nodesInvolved.length}</span>
				<span class="stat-label">nodes</span>
			</span>

			<button
				class="toggle-list-btn"
				class:active={showEventList}
				onclick={() => (showEventList = !showEventList)}
			>
				{showEventList ? 'Hide Events' : 'Show Events'}
			</button>
		</div>

		<!-- Event list (expandable) -->
		{#if showEventList}
			<div class="event-list-section">
				<!-- Filter -->
				<div class="event-filter">
					<select bind:value={eventFilter}>
						<option value="all">All Events</option>
						{#each eventTypes() as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>

				<!-- List -->
				<div class="event-list">
					{#each filteredEvents().slice(-50) as event}
						<div
							class="event-item"
							class:past={event.relativeTime < currentTime}
							class:current={Math.abs(event.relativeTime - currentTime) < 100}
							onclick={() => timelineRecorder.seek(event.relativeTime)}
						>
							<span class="event-time">{formatTime(event.relativeTime)}</span>
							<span class="event-type">{event.event.type}</span>
							{#if event.event.nodeId}
								<span class="event-node">{event.event.nodeId.slice(0, 8)}...</span>
							{/if}
						</div>
					{/each}
					{#if filteredEvents().length === 0}
						<div class="empty-state">No events recorded</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Clear button -->
		{#if events.length > 0 && !isRecording}
			<button class="clear-btn" onclick={handleClear}>
				Clear Timeline
			</button>
		{/if}
	</div>
</div>

<style>
	.timeline-panel {
		background: var(--bg-secondary, #1a1a24);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 8px;
		width: 400px;
		max-height: 500px;
		display: flex;
		flex-direction: column;
		font-family: var(--font-mono, monospace);
		font-size: 12px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.header-actions {
		display: flex;
		gap: 4px;
	}

	.icon-btn {
		background: none;
		border: none;
		color: var(--text-tertiary, #666);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.icon-btn:hover {
		color: var(--text-primary, #fff);
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	/* Transport controls */
	.transport-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}

	.transport-btn {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-secondary, #888);
		cursor: pointer;
		transition: all 0.15s;
	}

	.transport-btn:hover:not(:disabled) {
		background: var(--surface-border, #2a2a3a);
		color: var(--text-primary, #fff);
	}

	.transport-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.transport-btn.recording {
		background: #ef4444;
		border-color: #ef4444;
		color: white;
	}

	.transport-btn.play-btn {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--accent-primary, #22c55e);
		border-color: var(--accent-primary, #22c55e);
		color: var(--bg-primary, #0a0a0f);
	}

	.transport-btn.play-btn:hover:not(:disabled) {
		background: var(--accent-primary-hover, #16a34a);
	}

	.record-indicator {
		width: 12px;
		height: 12px;
		background: white;
		border-radius: 50%;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.transport-divider {
		width: 1px;
		height: 24px;
		background: var(--surface-border, #2a2a3a);
		margin: 0 4px;
	}

	.speed-btn {
		padding: 4px 8px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--accent-primary, #22c55e);
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		cursor: pointer;
	}

	.speed-btn:hover {
		background: var(--surface-border, #2a2a3a);
	}

	/* Scrubber */
	.scrubber {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.time-display {
		font-size: 10px;
		color: var(--text-tertiary, #666);
		min-width: 50px;
		text-align: center;
	}

	.scrubber-track {
		flex: 1;
		height: 8px;
		background: var(--surface, #252530);
		border-radius: 4px;
		position: relative;
		cursor: pointer;
	}

	.scrubber-progress {
		position: absolute;
		left: 0;
		top: 0;
		height: 100%;
		background: var(--accent-primary, #22c55e);
		opacity: 0.3;
		border-radius: 4px;
		pointer-events: none;
	}

	.scrubber-marker {
		position: absolute;
		top: -2px;
		width: 3px;
		height: 12px;
		border-radius: 1px;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.scrubber-playhead {
		position: absolute;
		top: -4px;
		width: 4px;
		height: 16px;
		background: var(--accent-primary, #22c55e);
		border-radius: 2px;
		transform: translateX(-50%);
		pointer-events: none;
		box-shadow: 0 0 4px var(--accent-primary, #22c55e);
	}

	/* Stats row */
	.stats-row {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 8px 0;
		border-top: 1px solid var(--surface-border, #2a2a3a);
	}

	.stat {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}

	.stat-value {
		font-size: 14px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.stat-label {
		font-size: 10px;
		color: var(--text-tertiary, #666);
	}

	.toggle-list-btn {
		margin-left: auto;
		padding: 4px 8px;
		background: transparent;
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-secondary, #888);
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		cursor: pointer;
	}

	.toggle-list-btn:hover {
		border-color: var(--text-tertiary, #666);
		color: var(--text-primary, #fff);
	}

	.toggle-list-btn.active {
		background: rgba(34, 197, 94, 0.1);
		border-color: var(--accent-primary, #22c55e);
		color: var(--accent-primary, #22c55e);
	}

	/* Event list */
	.event-list-section {
		border-top: 1px solid var(--surface-border, #2a2a3a);
		padding-top: 12px;
	}

	.event-filter {
		margin-bottom: 8px;
	}

	.event-filter select {
		width: 100%;
		padding: 6px 8px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
	}

	.event-list {
		max-height: 150px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.event-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		background: var(--surface, #252530);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.event-item:hover {
		background: var(--surface-border, #2a2a3a);
	}

	.event-item.past {
		opacity: 0.5;
	}

	.event-item.current {
		background: rgba(34, 197, 94, 0.2);
		border: 1px solid var(--accent-primary, #22c55e);
	}

	.event-time {
		font-size: 10px;
		color: var(--text-tertiary, #666);
		min-width: 50px;
	}

	.event-type {
		font-size: 11px;
		color: var(--accent-primary, #22c55e);
	}

	.event-node {
		font-size: 10px;
		color: var(--text-tertiary, #666);
		margin-left: auto;
	}

	.empty-state {
		padding: 16px;
		text-align: center;
		color: var(--text-tertiary, #666);
		font-size: 11px;
	}

	.clear-btn {
		margin-top: 8px;
		padding: 8px 16px;
		background: transparent;
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-tertiary, #666);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.clear-btn:hover {
		border-color: #ef4444;
		color: #ef4444;
	}

	/* Scrollbar */
	.event-list::-webkit-scrollbar,
	.panel-content::-webkit-scrollbar {
		width: 6px;
	}

	.event-list::-webkit-scrollbar-track,
	.panel-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.event-list::-webkit-scrollbar-thumb,
	.panel-content::-webkit-scrollbar-thumb {
		background: var(--surface-border, #2a2a3a);
		border-radius: 3px;
	}

	.event-list::-webkit-scrollbar-thumb:hover,
	.panel-content::-webkit-scrollbar-thumb:hover {
		background: var(--text-tertiary, #666);
	}
</style>
