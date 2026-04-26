<script lang="ts">
	/**
	 * Session State Bar
	 *
	 * Shows the current mission/session state when returning to the project.
	 * Displays:
	 * - Current mission name and progress
	 * - Active task being worked on
	 * - Quick actions (resume, view details)
	 */

	import { missionExecutor, type ExecutionProgress } from '$lib/services/mission-executor';
	import { getActiveMissionState, hasResumableMission, type PersistedMissionState } from '$lib/services/persistence';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// Props
	interface Props {
		onOpenExecution?: () => void;
	}

	let { onOpenExecution }: Props = $props();

	// State
	let sessionState = $state<PersistedMissionState | null>(null);
	let isVisible = $state(false);
	let isCollapsed = $state(false);

	onMount(() => {
		if (!browser) return;

		// Check for resumable mission state
		const state = getActiveMissionState();
		if (state && (state.status === 'running' || state.status === 'paused' || state.status === 'creating')) {
			sessionState = state;
			isVisible = true;
		}

		// Also check mission executor's current state
		const currentProgress = missionExecutor.getProgress();
		if (currentProgress.status !== 'idle' && currentProgress.missionId) {
			sessionState = {
				...currentProgress,
				taskProgressMap: Object.fromEntries(currentProgress.taskProgressMap),
				taskSkillMap: Object.fromEntries(currentProgress.taskSkillMap),
				startTime: currentProgress.startTime?.toISOString() || null,
				endTime: currentProgress.endTime?.toISOString() || null,
				savedAt: new Date().toISOString(),
				version: 1
			};
			isVisible = true;
		}
	});

	function getStatusColor(status: string): string {
		switch (status) {
			case 'running':
			case 'creating':
				return 'bg-vibe-teal';
			case 'paused':
				return 'bg-blue-500';
			case 'completed':
				return 'bg-accent-primary';
			case 'failed':
				return 'bg-red-500';
			default:
				return 'bg-text-tertiary';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'running':
				return 'In Progress';
			case 'creating':
				return 'Creating...';
			case 'paused':
				return 'Paused';
			case 'completed':
				return 'Completed';
			case 'failed':
				return 'Failed';
			default:
				return status;
		}
	}

	function formatTime(isoString: string | null): string {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleString();
	}

	function handleResume() {
		if (onOpenExecution) {
			onOpenExecution();
		}
	}

	function handleDismiss() {
		isVisible = false;
	}
</script>

{#if isVisible && sessionState}
	<div class="session-state-bar" class:collapsed={isCollapsed}>
		<!-- Collapsed indicator -->
		{#if isCollapsed}
			<button
				class="expand-button"
				onclick={() => isCollapsed = false}
				title="Show session state"
			>
				<div class="pulse-indicator {getStatusColor(sessionState.status)}"></div>
				<span class="collapsed-text">
					{sessionState.mission?.name || 'Mission'} - {sessionState.progress}%
				</span>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		{:else}
			<div class="session-content">
				<!-- Status indicator -->
				<div class="status-section">
					<div class="status-indicator {getStatusColor(sessionState.status)}">
						{#if sessionState.status === 'running' || sessionState.status === 'creating'}
							<div class="pulse-ring"></div>
						{/if}
					</div>
					<div class="status-info">
						<span class="status-label">{getStatusText(sessionState.status)}</span>
						<span class="mission-name">{sessionState.mission?.name || 'Mission'}</span>
					</div>
				</div>

				<!-- Progress -->
				<div class="progress-section">
					<div class="progress-bar-mini">
						<div class="progress-fill-mini {getStatusColor(sessionState.status)}" style="width: {sessionState.progress}%"></div>
					</div>
					<span class="progress-text">{sessionState.progress}%</span>
				</div>

				<!-- Current Task -->
				{#if sessionState.currentTaskName}
					<div class="current-task">
						<span class="task-label">Current:</span>
						<span class="task-name">{sessionState.currentTaskName}</span>
					</div>
				{/if}

				<!-- H70 Skills loaded -->
				{#if sessionState.loadedSkills && sessionState.loadedSkills.length > 0}
					<div class="skills-indicator">
						<span class="skills-count">{sessionState.loadedSkills.length} skills</span>
					</div>
				{/if}

				<!-- Time info -->
				{#if sessionState.startTime}
					<div class="time-info">
						Started: {formatTime(sessionState.startTime)}
					</div>
				{/if}

				<!-- Actions -->
				<div class="actions">
					<button class="action-btn primary" onclick={handleResume}>
						{sessionState.status === 'paused' ? 'Resume' : 'View'}
					</button>
					<button class="action-btn collapse" onclick={() => isCollapsed = true} title="Minimize">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					</button>
					<button class="action-btn dismiss" onclick={handleDismiss} title="Dismiss">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.session-state-bar {
		background: var(--bg-secondary, #111116);
		border-bottom: 1px solid var(--surface-border, #1a1a2e);
		padding: 0;
	}

	.session-state-bar.collapsed {
		padding: 0;
	}

	.expand-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.5rem 1rem;
		background: transparent;
		border: none;
		color: var(--text-secondary, #a0a0a0);
		cursor: pointer;
		transition: background 0.2s;
	}

	.expand-button:hover {
		background: var(--surface-tertiary, #1a1a2e);
	}

	.collapsed-text {
		font-size: 0.75rem;
		font-family: monospace;
	}

	.session-content {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.75rem 1rem;
		flex-wrap: wrap;
	}

	.status-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.status-indicator {
		position: relative;
		width: 10px;
		height: 10px;
	}

	.pulse-indicator {
		width: 8px;
		height: 8px;
	}

	.pulse-ring {
		position: absolute;
		inset: -4px;
		border: 2px solid currentColor;
		opacity: 0.5;
		animation: pulse-ring 1.5s infinite;
	}

	@keyframes pulse-ring {
		0% { transform: scale(0.8); opacity: 0.5; }
		100% { transform: scale(1.5); opacity: 0; }
	}

	.status-info {
		display: flex;
		flex-direction: column;
	}

	.status-label {
		font-size: 0.625rem;
		font-family: monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary, #5a5a6d);
	}

	.mission-name {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary, #e5e5e5);
	}

	.progress-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.progress-bar-mini {
		width: 100px;
		height: 6px;
		background: var(--surface-tertiary, #1a1a2e);
		overflow: hidden;
	}

	.progress-fill-mini {
		height: 100%;
		transition: width 0.3s ease;
	}

	.progress-text {
		font-size: 0.75rem;
		font-family: monospace;
		color: var(--accent-primary, #00ffff);
		min-width: 3ch;
	}

	.current-task {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		background: var(--surface-tertiary, #1a1a2e);
		border-left: 2px solid var(--accent, #2FCA94);
	}

	.task-label {
		font-size: 0.625rem;
		font-family: monospace;
		text-transform: uppercase;
		color: var(--text-tertiary, #5a5a6d);
	}

	.task-name {
		font-size: 0.75rem;
		color: var(--text-secondary, #a0a0a0);
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.skills-indicator {
		padding: 0.25rem 0.5rem;
		background: rgba(99, 102, 241, 0.2);
		border: 1px solid rgba(99, 102, 241, 0.4);
	}

	.skills-count {
		font-size: 0.625rem;
		font-family: monospace;
		color: var(--indigo-300, #a5b4fc);
	}

	.time-info {
		font-size: 0.625rem;
		font-family: monospace;
		color: var(--text-tertiary, #5a5a6d);
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		font-family: monospace;
		border: 1px solid var(--surface-border, #1a1a2e);
		background: transparent;
		color: var(--text-secondary, #a0a0a0);
		cursor: pointer;
		transition: all 0.2s;
	}

	.action-btn.primary {
		background: var(--accent-primary, #00ffff);
		color: var(--bg-primary, #0a0a0f);
		border-color: var(--accent-primary, #00ffff);
	}

	.action-btn.primary:hover {
		background: var(--accent-primary-hover, #00cccc);
	}

	.action-btn.collapse,
	.action-btn.dismiss {
		padding: 0.375rem;
	}

	.action-btn:hover:not(.primary) {
		border-color: var(--text-tertiary, #5a5a6d);
		color: var(--text-primary, #e5e5e5);
	}

	/* Color utilities */
	.bg-vibe-teal {
		background-color: #2FCA94;
	}

	.bg-blue-500 {
		background-color: #3B82F6;
	}

	.bg-accent-primary {
		background-color: var(--accent-primary, #00ffff);
	}

	.bg-red-500 {
		background-color: #EF4444;
	}

	.bg-text-tertiary {
		background-color: var(--text-tertiary, #5a5a6d);
	}
</style>
