<script lang="ts">
	import { onMount } from 'svelte';
	import type { Memory } from '$lib/types/memory';
	import { getRelevantLearnings, getWorkflowPatterns } from '$lib/stores/mind.svelte';
	import { isMemoryConnected } from '$lib/stores/memory-settings.svelte';

	interface Props {
		goalDescription: string;
		skillIds?: string[];
		onApplyPattern?: (pattern: Memory) => void;
		onDismiss?: () => void;
	}

	let { goalDescription, skillIds = [], onApplyPattern, onDismiss }: Props = $props();

	let loading = $state(true);
	let relevantLearnings = $state<Memory[]>([]);
	let suggestedPatterns = $state<Memory[]>([]);
	let memoryConnected = $state(false);
	let expanded = $state(true);

	interface LearningMetadata {
		pattern_type?: 'success' | 'failure' | 'optimization';
		confidence?: number;
		agent_id?: string;
		skill_id?: string;
	}

	interface PatternMetadata {
		name?: string;
		skill_sequence?: string[];
		success_rate?: number;
	}

	$effect(() => {
		const unsub = isMemoryConnected.subscribe((v) => (memoryConnected = v));
		return unsub;
	});

	onMount(async () => {
		if (!memoryConnected) {
			loading = false;
			return;
		}

		await loadSuggestions();
	});

	async function loadSuggestions() {
		loading = true;

		try {
			// Get relevant learnings based on goal
			const learnings = await getRelevantLearnings(goalDescription, {
				limit: 5
			});
			relevantLearnings = learnings;

			// Get workflow patterns that might apply
			const patterns = await getWorkflowPatterns(goalDescription);
			suggestedPatterns = patterns.slice(0, 3);
		} catch (error) {
			console.error('Failed to load suggestions:', error);
		}

		loading = false;
	}

	function getTypeIcon(type?: string): string {
		switch (type) {
			case 'success': return '+';
			case 'failure': return '!';
			case 'optimization': return '*';
			default: return '~';
		}
	}

	function getTypeColor(type?: string): string {
		switch (type) {
			case 'success': return 'text-green-400';
			case 'failure': return 'text-amber-400';
			case 'optimization': return 'text-blue-400';
			default: return 'text-text-secondary';
		}
	}

	function formatConfidence(confidence?: number): string {
		if (confidence === undefined) return '';
		return `${Math.round(confidence * 100)}%`;
	}

	const hasContent = $derived(relevantLearnings.length > 0 || suggestedPatterns.length > 0);
</script>

{#if memoryConnected && (loading || hasContent)}
	<div class="border border-accent-primary/30 bg-accent-primary/5">
		<!-- Header -->
		<div class="p-3 flex items-center justify-between">
			<button
				class="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
				onclick={() => (expanded = !expanded)}
			>
				<span class="text-accent-primary font-mono">~</span>
				<span class="text-sm font-medium text-text-primary">Mind Suggestions</span>
				{#if !loading && hasContent}
					<span class="text-xs font-mono text-text-tertiary">
						({relevantLearnings.length + suggestedPatterns.length})
					</span>
				{/if}
				<span class="text-text-tertiary text-xs ml-2">{expanded ? '−' : '+'}</span>
			</button>
			<div class="flex items-center gap-2">
				{#if onDismiss}
					<button
						class="text-xs font-mono text-text-tertiary hover:text-text-secondary px-2"
						onclick={() => onDismiss?.()}
					>
						dismiss
					</button>
				{/if}
			</div>
		</div>

		{#if expanded}
			<div class="border-t border-accent-primary/20">
				{#if loading}
					<div class="p-4 text-center">
						<div class="animate-pulse text-text-tertiary font-mono text-sm">
							Searching past learnings...
						</div>
					</div>
				{:else if !hasContent}
					<div class="p-4 text-center text-text-tertiary text-sm">
						No relevant suggestions found.
					</div>
				{:else}
					<!-- Workflow Patterns -->
					{#if suggestedPatterns.length > 0}
						<div class="p-3 border-b border-accent-primary/20">
							<div class="text-xs font-mono text-accent-primary uppercase tracking-wider mb-2">
								Suggested Patterns
							</div>
							<div class="space-y-2">
								{#each suggestedPatterns as pattern}
									{@const meta = pattern.metadata as PatternMetadata}
									<div class="p-2 bg-bg-secondary border border-surface-border">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<div class="text-sm text-text-primary font-medium">
													{meta?.name || 'Workflow Pattern'}
												</div>
												{#if meta?.skill_sequence}
													<div class="flex flex-wrap items-center gap-1 mt-1">
														{#each meta.skill_sequence as skill, i}
															<span class="px-1.5 py-0.5 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10">
																{skill}
															</span>
															{#if i < meta.skill_sequence.length - 1}
																<span class="text-text-tertiary text-xs">&rarr;</span>
															{/if}
														{/each}
													</div>
												{/if}
											</div>
											{#if meta?.success_rate !== undefined}
												<div class="text-xs font-mono text-green-400">
													{Math.round(meta.success_rate * 100)}%
												</div>
											{/if}
										</div>
										{#if onApplyPattern}
											<button
												class="mt-2 text-xs font-mono text-accent-primary hover:underline"
												onclick={() => onApplyPattern?.(pattern)}
											>
												Apply this pattern
											</button>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}

					<!-- Relevant Learnings -->
					{#if relevantLearnings.length > 0}
						<div class="p-3">
							<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
								Past Learnings
							</div>
							<div class="space-y-2">
								{#each relevantLearnings as learning}
									{@const meta = learning.metadata as LearningMetadata}
									<div class="flex items-start gap-2 p-2 bg-bg-secondary border border-surface-border">
										<span class="font-mono {getTypeColor(meta?.pattern_type)}">
											{getTypeIcon(meta?.pattern_type)}
										</span>
										<div class="flex-1 min-w-0">
											<p class="text-sm text-text-primary">{learning.content}</p>
											<div class="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
												{#if meta?.agent_id}
													<span class="font-mono">@{meta.agent_id}</span>
												{/if}
												{#if meta?.confidence}
													<span class="font-mono">{formatConfidence(meta.confidence)}</span>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>
{/if}
