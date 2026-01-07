<script lang="ts">
	import type { Memory } from '$lib/types/memory';

	interface Props {
		learnings: Memory[];
		loading?: boolean;
		onLearningClick?: (learning: Memory) => void;
	}

	let { learnings = [], loading = false, onLearningClick }: Props = $props();

	interface LearningMetadata {
		agent_id?: string;
		agent_name?: string;
		skill_id?: string;
		mission_id?: string;
		pattern_type?: 'success' | 'failure' | 'optimization';
		confidence?: number;
		decision_context?: string;
		reasoning?: string;
	}

	function getMetadata(learning: Memory): LearningMetadata {
		return (learning.metadata || {}) as LearningMetadata;
	}

	function getTypeIcon(type?: string): string {
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

	function getTypeColor(type?: string): string {
		switch (type) {
			case 'success':
				return 'border-green-500/30 bg-green-500/10';
			case 'failure':
				return 'border-red-500/30 bg-red-500/10';
			case 'optimization':
				return 'border-blue-500/30 bg-blue-500/10';
			default:
				return 'border-surface-border bg-bg-secondary';
		}
	}

	function getTypeTextColor(type?: string): string {
		switch (type) {
			case 'success':
				return 'text-green-400';
			case 'failure':
				return 'text-red-400';
			case 'optimization':
				return 'text-blue-400';
			default:
				return 'text-text-secondary';
		}
	}

	function formatDate(dateStr?: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatConfidence(confidence?: number): string {
		if (confidence === undefined) return '';
		return `${Math.round(confidence * 100)}%`;
	}

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
		{#each Object.entries(groupedLearnings()) as [date, dateLearnings]}
			<div>
				<!-- Date Header -->
				<div class="flex items-center gap-3 mb-3">
					<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">{date}</div>
					<div class="flex-1 h-px bg-surface-border"></div>
					<div class="text-xs font-mono text-text-tertiary">{dateLearnings.length} learnings</div>
				</div>

				<!-- Learnings for this date -->
				<div class="space-y-2 pl-4 border-l-2 border-surface-border">
					{#each dateLearnings as learning}
						{@const meta = getMetadata(learning)}
						<button
							class="w-full text-left p-4 border transition-all hover:border-text-tertiary {getTypeColor(
								meta.pattern_type
							)}"
							onclick={() => onLearningClick?.(learning)}
						>
							<div class="flex items-start gap-3">
								<!-- Type Icon -->
								<span class="font-mono text-lg {getTypeTextColor(meta.pattern_type)}">
									{getTypeIcon(meta.pattern_type)}
								</span>

								<div class="flex-1 min-w-0">
									<!-- Content -->
									<p class="text-text-primary">{learning.content || 'No content'}</p>

									<!-- Metadata Row -->
									<div class="flex flex-wrap items-center gap-3 mt-2 text-xs">
										{#if meta.agent_name || meta.agent_id}
											<span class="font-mono text-text-tertiary">
												@{meta.agent_name || meta.agent_id}
											</span>
										{/if}

										{#if meta.skill_id}
											<span class="px-1.5 py-0.5 font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10">
												{meta.skill_id}
											</span>
										{/if}

										{#if meta.confidence !== undefined}
											<span class="font-mono text-text-tertiary">
												{formatConfidence(meta.confidence)} conf
											</span>
										{/if}

										{#if learning.created_at}
											<span class="font-mono text-text-tertiary ml-auto">
												{formatDate(learning.created_at)}
											</span>
										{/if}
									</div>

									<!-- Reasoning (if available) -->
									{#if meta.reasoning}
										<p class="mt-2 text-sm text-text-secondary italic">
											"{meta.reasoning}"
										</p>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>
