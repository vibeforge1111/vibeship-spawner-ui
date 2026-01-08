<script lang="ts">
	import type { Improvement } from '$lib/types/memory';

	interface Props {
		improvement: Improvement;
		onApply?: (id: string) => void;
		onDismiss?: (id: string) => void;
		onViewEvidence?: (id: string) => void;
	}

	let { improvement, onApply, onDismiss, onViewEvidence }: Props = $props();

	const typeIcons: Record<string, string> = {
		skill: '🎯',
		agent: '🤖',
		team: '👥',
		pipeline: '🔄'
	};

	const typeLabels: Record<string, string> = {
		skill: 'Skill',
		agent: 'Agent',
		team: 'Team',
		pipeline: 'Pipeline'
	};

	const typeColors: Record<string, string> = {
		skill: 'border-blue-500/30 bg-blue-500/10',
		agent: 'border-purple-500/30 bg-purple-500/10',
		team: 'border-green-500/30 bg-green-500/10',
		pipeline: 'border-orange-500/30 bg-orange-500/10'
	};

	const statusColors: Record<string, string> = {
		pending: 'text-yellow-400',
		applied: 'text-green-400',
		dismissed: 'text-text-tertiary'
	};

	function formatImpact(impact: number): string {
		const percent = Math.round(impact * 100);
		return percent > 0 ? `+${percent}%` : `${percent}%`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="border {typeColors[improvement.type]} p-4 transition-all hover:border-opacity-50">
	<!-- Header -->
	<div class="flex items-start justify-between gap-3 mb-3">
		<div class="flex items-center gap-2">
			<span class="text-lg">{typeIcons[improvement.type]}</span>
			<div>
				<span class="font-mono text-xs text-text-tertiary uppercase tracking-wider">
					{typeLabels[improvement.type]}
				</span>
				<h3 class="font-medium text-text-primary">{improvement.targetName}</h3>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<!-- Impact badge -->
			<span class="px-2 py-0.5 text-sm font-mono text-accent-primary bg-accent-primary/10 border border-accent-primary/30">
				{formatImpact(improvement.impact)}
			</span>

			<!-- Status indicator -->
			{#if improvement.status !== 'pending'}
				<span class="px-2 py-0.5 text-xs font-mono {statusColors[improvement.status]} border border-current/30 bg-current/10">
					{improvement.status}
				</span>
			{/if}
		</div>
	</div>

	<!-- Suggestion -->
	<p class="text-sm text-text-secondary mb-3">
		"{improvement.suggestion}"
	</p>

	<!-- Meta info -->
	<div class="flex items-center gap-4 text-xs text-text-tertiary font-mono mb-3">
		<span>Source: {improvement.evidenceCount} task outcomes</span>
		<span>Confidence: {Math.round(improvement.confidence * 100)}%</span>
		<span>{formatDate(improvement.createdAt)}</span>
	</div>

	<!-- Actions -->
	{#if improvement.status === 'pending'}
		<div class="flex items-center gap-2 pt-2 border-t border-surface-border">
			<button
				onclick={() => onApply?.(improvement.id)}
				class="px-3 py-1 text-xs font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
			>
				Apply
			</button>
			<button
				onclick={() => onDismiss?.(improvement.id)}
				class="px-3 py-1 text-xs font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
			>
				Dismiss
			</button>
			{#if improvement.sourceMissions.length > 0}
				<button
					onclick={() => onViewEvidence?.(improvement.id)}
					class="px-3 py-1 text-xs font-mono text-text-tertiary hover:text-text-secondary transition-all"
				>
					View Evidence
				</button>
			{/if}
		</div>
	{:else if improvement.status === 'applied'}
		<div class="flex items-center gap-2 pt-2 border-t border-surface-border text-xs text-green-400">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
			</svg>
			Applied {improvement.appliedAt ? formatDate(improvement.appliedAt) : ''}
		</div>
	{/if}
</div>
