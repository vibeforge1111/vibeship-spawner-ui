<script lang="ts">
	import { memoryClient } from '$lib/services/memory-client';
	import type { ScoredMemory } from '$lib/types/memory';

	interface Props {
		currentTaskName: string | null;
		currentTaskDescription?: string;
		skillId?: string;
		agentId?: string;
		collapsed?: boolean;
		onToggle?: () => void;
	}

	let {
		currentTaskName,
		currentTaskDescription = '',
		skillId,
		agentId,
		collapsed = true,
		onToggle
	}: Props = $props();

	let guidance = $state<ScoredMemory[]>([]);
	let loading = $state(false);
	let lastTaskName = $state<string | null>(null);

	// Fetch guidance when task changes
	$effect(() => {
		if (currentTaskName && currentTaskName !== lastTaskName) {
			lastTaskName = currentTaskName;
			fetchGuidance();
		}
	});

	async function fetchGuidance() {
		if (!currentTaskName) return;

		loading = true;
		guidance = [];

		try {
			const query = currentTaskDescription || currentTaskName;
			const result = await memoryClient.getRelevantLearnings(query, {
				skillId,
				agentId,
				limit: 3
			});

			if (result.success && result.data) {
				// Filter to only high-confidence learnings
				guidance = result.data.filter(sm => {
					const conf = sm.memory.metadata?.confidence ?? sm.memory.effective_salience;
					return conf >= 0.5;
				});
			}
		} catch (error) {
			console.error('[MidMissionGuidance] Failed to fetch guidance:', error);
		} finally {
			loading = false;
		}
	}

	function getTypeIcon(patternType?: string): string {
		switch (patternType) {
			case 'success': return '+';
			case 'failure': return '!';
			case 'optimization': return '*';
			default: return '~';
		}
	}

	function getTypeColor(patternType?: string): string {
		switch (patternType) {
			case 'success': return 'text-green-400';
			case 'failure': return 'text-red-400';
			case 'optimization': return 'text-blue-400';
			default: return 'text-text-secondary';
		}
	}

	function getBorderColor(patternType?: string): string {
		switch (patternType) {
			case 'success': return 'border-green-500/30';
			case 'failure': return 'border-red-500/30';
			case 'optimization': return 'border-blue-500/30';
			default: return 'border-surface-border';
		}
	}

	let hasGuidance = $derived(guidance.length > 0);
</script>

<!-- Mid-Mission Guidance Panel -->
{#if hasGuidance || loading}
	<div class="border border-surface-border bg-bg-tertiary/50">
		<!-- Header -->
		<button
			onclick={onToggle}
			class="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors"
		>
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<span class="text-xs font-mono text-text-secondary">Guidance</span>
				{#if guidance.length > 0}
					<span class="px-1.5 py-0.5 text-[10px] font-mono bg-blue-500/20 text-blue-400 rounded-sm">
						{guidance.length}
					</span>
				{/if}
			</div>
			<div class="flex items-center gap-2">
				{#if loading}
					<span class="animate-pulse text-xs text-text-tertiary">...</span>
				{/if}
				<svg
					class="w-4 h-4 text-text-tertiary transition-transform"
					class:rotate-180={!collapsed}
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
			</div>
		</button>

		<!-- Content -->
		{#if !collapsed}
			<div class="px-3 pb-3 space-y-2">
				{#if loading}
					<div class="text-xs text-text-tertiary py-2 animate-pulse">
						Finding relevant learnings...
					</div>
				{:else if guidance.length === 0}
					<div class="text-xs text-text-tertiary py-2">
						No relevant guidance for this task.
					</div>
				{:else}
					{#each guidance as item}
						{@const meta = item.memory.metadata as { pattern_type?: string; skill_id?: string; confidence?: number } | undefined}
						<div class="p-2 border {getBorderColor(meta?.pattern_type)} bg-surface/30">
							<div class="flex items-start gap-2">
								<span class="font-mono text-sm {getTypeColor(meta?.pattern_type)}">
									{getTypeIcon(meta?.pattern_type)}
								</span>
								<div class="flex-1 min-w-0">
									<p class="text-xs text-text-primary line-clamp-2">{item.memory.content}</p>
									<div class="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary">
										{#if meta?.skill_id}
											<span class="font-mono">{meta.skill_id}</span>
										{/if}
										{#if meta?.confidence !== undefined}
											<span class="font-mono">{Math.round(meta.confidence * 100)}% conf</span>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
