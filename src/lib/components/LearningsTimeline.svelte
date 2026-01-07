<script lang="ts">
	import type { Memory } from '$lib/types/memory';
	import LearningCard from './LearningCard.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		learnings: Memory[];
		loading?: boolean;
		compact?: boolean;
		onLearningClick?: (learning: Memory) => void;
	}

	let { learnings = [], loading = false, compact = false, onLearningClick }: Props = $props();

	// Group learnings by date (filter out invalid entries first)
	const groupedLearnings = $derived(() => {
		const groups: { [key: string]: Memory[] } = {};
		// Filter out undefined/null entries and entries without content
		const validLearnings = learnings.filter(l => l && l.content);
		for (const learning of validLearnings) {
			const date = learning.created_at
				? new Date(learning.created_at).toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					})
				: 'Unknown';
			if (!groups[date]) groups[date] = [];
			groups[date].push(learning);
		}
		return groups;
	});

	// Stats
	const stats = $derived(() => {
		const validLearnings = learnings.filter(l => l && l.content);
		let success = 0, failure = 0, optimization = 0, other = 0;

		for (const learning of validLearnings) {
			const meta = learning.metadata as { pattern_type?: string } | undefined;
			switch (meta?.pattern_type) {
				case 'success': success++; break;
				case 'failure': failure++; break;
				case 'optimization': optimization++; break;
				default: other++; break;
			}
		}

		return { success, failure, optimization, other, total: validLearnings.length };
	});
</script>

<div class="space-y-6">
	{#if loading}
		<div class="border border-surface-border bg-bg-secondary p-8 text-center">
			<div class="animate-pulse text-text-tertiary font-mono text-sm">Loading learnings...</div>
		</div>
	{:else if learnings.length === 0}
		<div class="border border-surface-border bg-bg-secondary p-12 text-center">
			<div class="text-4xl mb-4 opacity-50">~</div>
			<h3 class="text-lg text-text-primary mb-2">No learnings yet</h3>
			<p class="text-sm text-text-secondary">
				Agent learnings will appear here as missions complete.
			</p>
		</div>
	{:else}
		<!-- Stats Summary -->
		{#if !compact && stats().total > 0}
			<div class="flex items-center gap-4 p-3 border border-surface-border bg-bg-secondary">
				<span class="text-xs font-mono text-text-tertiary">
					{stats().total} learnings
				</span>
				{#if stats().success > 0}
					<span class="flex items-center gap-1 text-xs font-mono text-green-400">
						<Icon name="check" size={12} />
						{stats().success} success
					</span>
				{/if}
				{#if stats().failure > 0}
					<span class="flex items-center gap-1 text-xs font-mono text-red-400">
						<Icon name="alert-triangle" size={12} />
						{stats().failure} failure
					</span>
				{/if}
				{#if stats().optimization > 0}
					<span class="flex items-center gap-1 text-xs font-mono text-blue-400">
						<Icon name="zap" size={12} />
						{stats().optimization} optimization
					</span>
				{/if}
			</div>
		{/if}

		{#each Object.entries(groupedLearnings()) as [date, dateLearnings]}
			<div>
				<!-- Date Header -->
				<div class="flex items-center gap-3 mb-3">
					<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">{date}</div>
					<div class="flex-1 h-px bg-surface-border"></div>
					<div class="text-xs font-mono text-text-tertiary">{dateLearnings.length} learnings</div>
				</div>

				<!-- Learnings for this date -->
				<div class="space-y-3 pl-4 border-l-2 border-surface-border">
					{#each dateLearnings as learning}
						<LearningCard
							{learning}
							{compact}
							onClick={onLearningClick}
						/>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
