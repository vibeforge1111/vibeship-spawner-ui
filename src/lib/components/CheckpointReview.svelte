<script lang="ts">
	import type { ProjectCheckpoint } from '$lib/services/checkpoint';

	interface Props {
		checkpoint: ProjectCheckpoint;
		onVerify?: () => void;
		onReject?: (reason: string) => void;
	}

	let { checkpoint, onVerify, onReject }: Props = $props();

	let rejectReason = $state('');
	let showRejectForm = $state(false);

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'success': return '✅';
			case 'partial': return '⚠️';
			case 'failed': return '❌';
			default: return '❓';
		}
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${mins}m`;
	}

	function formatBoolResult(value: boolean | null): string {
		if (value === null) return '—';
		return value ? '✅ Passed' : '❌ Failed';
	}

	function handleReject() {
		if (rejectReason.trim()) {
			onReject?.(rejectReason);
		}
	}
</script>

<div class="bg-surface-secondary border border-surface-border p-4 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<span class="text-3xl">{getStatusIcon(checkpoint.status)}</span>
			<div>
				<h2 class="text-xl font-mono">{checkpoint.missionName}</h2>
				<p class="text-sm text-text-secondary">
					Completed {checkpoint.completedAt.toLocaleString()} • {formatDuration(checkpoint.duration)}
				</p>
			</div>
		</div>
		<div class="text-right">
			<span class="text-lg font-mono uppercase {checkpoint.status === 'success' ? 'text-green-400' : checkpoint.status === 'partial' ? 'text-yellow-400' : 'text-red-400'}">
				{checkpoint.status}
			</span>
			<p class="text-sm text-text-secondary">
				Ship Ready: {checkpoint.canShip ? '✅ Yes' : '❌ No'}
			</p>
		</div>
	</div>

	<!-- Automated Results -->
	<div>
		<h3 class="font-mono text-lg mb-2">Automated Results</h3>
		<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Tasks Completed</p>
				<p class="font-mono text-lg">{checkpoint.automated.tasksCompleted}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Tasks Failed</p>
				<p class="font-mono text-lg {checkpoint.automated.tasksFailed > 0 ? 'text-red-400' : ''}">{checkpoint.automated.tasksFailed}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Tests Passed</p>
				<p class="font-mono text-lg">{checkpoint.automated.testsPassed}/{checkpoint.automated.testsRun}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Build</p>
				<p class="font-mono">{formatBoolResult(checkpoint.automated.buildSucceeded)}</p>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2 mt-2">
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Type Check</p>
				<p class="font-mono">{formatBoolResult(checkpoint.automated.typeCheckPassed)}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Lint</p>
				<p class="font-mono">{formatBoolResult(checkpoint.automated.lintPassed)}</p>
			</div>
		</div>
	</div>

	<!-- Quality Metrics -->
	<div>
		<h3 class="font-mono text-lg mb-2">Quality Metrics</h3>
		<div class="grid grid-cols-3 gap-2">
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Skill Usage</p>
				<p class="font-mono text-lg">{Math.round(checkpoint.quality.skillUsageRatio * 100)}%</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Avg Task Quality</p>
				<p class="font-mono text-lg">{Math.round(checkpoint.quality.averageTaskQuality)}/100</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Completion Rate</p>
				<p class="font-mono text-lg">{Math.round(checkpoint.quality.completionRate * 100)}%</p>
			</div>
		</div>
	</div>

	<!-- Known Issues -->
	{#if checkpoint.review.knownIssues.length > 0}
		<div>
			<h3 class="font-mono text-lg mb-2">Known Issues</h3>
			<div class="space-y-1">
				{#each checkpoint.review.knownIssues as issue}
					<div class="flex items-start gap-2 p-2 bg-yellow-900/20 border border-yellow-600/30">
						<span>⚠️</span>
						<span class="text-yellow-400">{issue}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Manual Testing Checklist -->
	{#if checkpoint.review.manualTestSuggestions.length > 0}
		<div>
			<h3 class="font-mono text-lg mb-2">Manual Testing Checklist</h3>
			<div class="space-y-4">
				{#each checkpoint.review.manualTestSuggestions as suggestion}
					<div>
						<h4 class="font-mono text-accent-primary mb-1">{suggestion.category}</h4>
						<div class="space-y-1">
							{#each suggestion.tests as test}
								<label class="flex items-center gap-2 p-1 hover:bg-surface-primary cursor-pointer">
									<input type="checkbox" class="form-checkbox" />
									<span class="text-sm">{test}</span>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Summary -->
	<div class="p-3 bg-surface-primary border border-surface-border">
		<p class="text-text-secondary">{checkpoint.review.summary}</p>
	</div>

	<!-- Actions -->
	<div class="flex gap-2 pt-4 border-t border-surface-border">
		{#if !showRejectForm}
			<button
				class="btn-primary px-6 py-2"
				onclick={onVerify}
				disabled={!checkpoint.canShip}
			>
				✅ Verify & Ship
			</button>
			<button
				class="btn-secondary px-6 py-2"
				onclick={() => showRejectForm = true}
			>
				❌ Needs Work
			</button>
		{:else}
			<div class="flex-1 flex gap-2">
				<input
					type="text"
					bind:value={rejectReason}
					placeholder="What needs to be fixed?"
					class="flex-1 px-3 py-2 bg-surface-primary border border-surface-border font-mono"
				/>
				<button
					class="btn-secondary px-4 py-2"
					onclick={handleReject}
					disabled={!rejectReason.trim()}
				>
					Submit
				</button>
				<button
					class="btn-ghost px-4 py-2"
					onclick={() => showRejectForm = false}
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
</div>
