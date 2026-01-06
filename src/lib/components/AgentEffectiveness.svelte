<script lang="ts">
	import type { Memory, AgentEffectiveness } from '$lib/types/memory';

	interface Props {
		agentId: string;
		agentName: string;
		stats?: AgentEffectiveness;
		learnings?: Memory[];
		loading?: boolean;
	}

	let { agentId, agentName, stats, learnings = [], loading = false }: Props = $props();

	const successRate = $derived(
		stats ? Math.round((stats.successfulTasks / Math.max(stats.totalTasks, 1)) * 100) : 0
	);

	const recentLearnings = $derived(learnings.slice(0, 5));

	function getSuccessColor(rate: number): string {
		if (rate >= 80) return 'text-green-400';
		if (rate >= 60) return 'text-yellow-400';
		return 'text-red-400';
	}

	function getPatternIcon(type: string): string {
		switch (type) {
			case 'success':
				return '+';
			case 'failure':
				return '!';
			case 'optimization':
				return '*';
			default:
				return '~';
		}
	}

	function getPatternColor(type: string): string {
		switch (type) {
			case 'success':
				return 'text-green-400 border-green-500/30 bg-green-500/10';
			case 'failure':
				return 'text-red-400 border-red-500/30 bg-red-500/10';
			case 'optimization':
				return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
			default:
				return 'text-text-secondary border-surface-border bg-bg-secondary';
		}
	}

	function formatConfidence(confidence: number): string {
		return `${Math.round(confidence * 100)}%`;
	}
</script>

<div class="border border-surface-border bg-bg-secondary">
	<!-- Header -->
	<div class="p-4 border-b border-surface-border flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div
				class="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-mono text-sm"
			>
				{agentName.charAt(0).toUpperCase()}
			</div>
			<div>
				<h3 class="font-medium text-text-primary">{agentName}</h3>
				<p class="text-xs font-mono text-text-tertiary">{agentId}</p>
			</div>
		</div>

		{#if stats}
			<div class="text-right">
				<div class="text-2xl font-mono {getSuccessColor(successRate)}">{successRate}%</div>
				<div class="text-xs text-text-tertiary">success rate</div>
			</div>
		{/if}
	</div>

	<!-- Stats Grid -->
	{#if loading}
		<div class="p-6 text-center">
			<div class="animate-pulse text-text-tertiary font-mono text-sm">Loading stats...</div>
		</div>
	{:else if stats}
		<div class="grid grid-cols-4 divide-x divide-surface-border border-b border-surface-border">
			<div class="p-3 text-center">
				<div class="text-lg font-mono text-text-primary">{stats.totalTasks}</div>
				<div class="text-xs text-text-tertiary">Tasks</div>
			</div>
			<div class="p-3 text-center">
				<div class="text-lg font-mono text-green-400">{stats.successfulTasks}</div>
				<div class="text-xs text-text-tertiary">Succeeded</div>
			</div>
			<div class="p-3 text-center">
				<div class="text-lg font-mono text-red-400">{stats.failedTasks}</div>
				<div class="text-xs text-text-tertiary">Failed</div>
			</div>
			<div class="p-3 text-center">
				<div class="text-lg font-mono text-text-primary">{stats.totalLearnings}</div>
				<div class="text-xs text-text-tertiary">Learnings</div>
			</div>
		</div>

		<!-- Top Skills -->
		{#if stats.topSkills && stats.topSkills.length > 0}
			<div class="p-4 border-b border-surface-border">
				<h4 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
					Top Skills
				</h4>
				<div class="flex flex-wrap gap-2">
					{#each stats.topSkills as skill}
						<span class="px-2 py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10">
							{skill}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	{:else}
		<div class="p-6 text-center">
			<div class="text-text-tertiary text-sm">No stats available yet</div>
		</div>
	{/if}

	<!-- Recent Learnings -->
	{#if recentLearnings.length > 0}
		<div class="p-4">
			<h4 class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-3">
				Recent Learnings
			</h4>
			<div class="space-y-2">
				{#each recentLearnings as learning}
					{@const metadata = learning.metadata as { pattern_type?: string; confidence?: number }}
					<div class="p-3 border {getPatternColor(metadata?.pattern_type || 'default')}">
						<div class="flex items-start gap-2">
							<span class="font-mono text-sm">
								{getPatternIcon(metadata?.pattern_type || 'default')}
							</span>
							<div class="flex-1 min-w-0">
								<p class="text-sm text-text-primary truncate">{learning.content}</p>
								{#if metadata?.confidence}
									<span class="text-xs text-text-tertiary">
										{formatConfidence(metadata.confidence)} confidence
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
