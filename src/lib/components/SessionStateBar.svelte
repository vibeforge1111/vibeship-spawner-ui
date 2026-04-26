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
			case 'completed':
				return 'bg-accent-primary';
			case 'paused':
				return 'bg-status-amber';
			case 'failed':
				return 'bg-status-error';
			default:
				return 'bg-text-tertiary';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'running':
				return 'running';
			case 'creating':
				return 'creating';
			case 'paused':
				return 'paused';
			case 'completed':
				return 'complete';
			case 'failed':
				return 'failed';
			default:
				return status;
		}
	}

	function isLive(status: string | undefined): boolean {
		return status === 'running' || status === 'creating';
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
	<div class="px-6 py-3 border-b border-surface-border bg-bg-secondary">
		{#if isCollapsed}
			<button
				type="button"
				class="flex items-center gap-3 w-full text-left rounded-md px-2 py-1.5 hover:bg-bg-primary/40 transition-all"
				onclick={() => (isCollapsed = false)}
				title="Show session state"
			>
				{#if isLive(sessionState.status)}
					<span class="relative flex h-2.5 w-2.5">
						<span class="absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-60 animate-ping-slow"></span>
						<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-primary"></span>
					</span>
				{:else}
					<span class="w-2.5 h-2.5 rounded-full {getStatusColor(sessionState.status)}"></span>
				{/if}
				<span class="font-mono text-sm text-text-primary">
					{getStatusText(sessionState.status)} ·
					<span class="text-text-secondary">{sessionState.mission?.name || 'Mission'}</span>
					<span class="text-text-tertiary tabular-nums ml-1">{sessionState.progress}%</span>
				</span>
				<svg class="w-4 h-4 ml-auto text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
		{:else}
			<div class="flex items-center gap-5 flex-wrap">
				<!-- Status + mission name -->
				<div class="flex items-center gap-3 min-w-0">
					{#if isLive(sessionState.status)}
						<span class="relative flex h-2.5 w-2.5 shrink-0">
							<span class="absolute inline-flex h-full w-full rounded-full bg-accent-primary opacity-60 animate-ping-slow"></span>
							<span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent-primary"></span>
						</span>
					{:else}
						<span class="w-2.5 h-2.5 rounded-full shrink-0 {getStatusColor(sessionState.status)}"></span>
					{/if}
					<div class="flex flex-col min-w-0">
						<span class="font-mono text-xs text-accent-primary tracking-widest uppercase">{getStatusText(sessionState.status)}</span>
						<span class="text-base font-sans font-semibold text-text-primary truncate">{sessionState.mission?.name || 'Mission'}</span>
					</div>
				</div>

				<!-- Progress -->
				<div class="flex items-center gap-3 min-w-[180px] flex-1 max-w-[280px]">
					<div class="flex-1 h-1.5 rounded-full bg-surface overflow-hidden">
						<div
							class="h-full rounded-full bg-accent-primary transition-all duration-500 ease-out"
							style="width: {sessionState.progress}%"
						></div>
					</div>
					<span class="font-mono text-sm text-text-primary tabular-nums shrink-0">{sessionState.progress}%</span>
				</div>

				<!-- Current task -->
				{#if sessionState.currentTaskName}
					<div class="flex items-center gap-2.5 px-3 py-1.5 rounded-md bg-bg-primary/60 border border-surface-border min-w-0 max-w-[340px]">
						<span class="font-mono text-[10px] text-text-tertiary tracking-widest uppercase shrink-0">Current</span>
						<span class="text-sm text-text-secondary truncate">{sessionState.currentTaskName}</span>
					</div>
				{/if}

				<!-- Skills count -->
				{#if sessionState.loadedSkills && sessionState.loadedSkills.length > 0}
					<div class="px-3 py-1.5 rounded-full border border-accent-primary/40 bg-accent-primary/10 shrink-0">
						<span class="font-mono text-xs text-accent-primary tabular-nums">{sessionState.loadedSkills.length} skills</span>
					</div>
				{/if}

				<!-- Time -->
				{#if sessionState.startTime}
					<div class="font-mono text-xs text-text-tertiary tabular-nums shrink-0 hidden lg:block">
						started {formatTime(sessionState.startTime)}
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex items-center gap-2 ml-auto shrink-0">
					<button
						type="button"
						class="px-4 py-2 rounded-md text-sm font-semibold bg-accent-primary text-accent-fg hover:opacity-85 active:scale-[0.98] transition-all"
						onclick={handleResume}
					>
						{sessionState.status === 'paused' ? 'Resume' : 'View'}
					</button>
					<button
						type="button"
						class="p-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition-all"
						onclick={() => (isCollapsed = true)}
						title="Minimize"
						aria-label="Minimize"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
						</svg>
					</button>
					<button
						type="button"
						class="p-2 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition-all"
						onclick={handleDismiss}
						title="Dismiss"
						aria-label="Dismiss"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

