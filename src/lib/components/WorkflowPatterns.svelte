<script lang="ts">
	import type { Memory } from '$lib/types/memory';

	interface Props {
		patterns: Memory[];
		loading?: boolean;
		onPatternClick?: (pattern: Memory) => void;
	}

	let { patterns = [], loading = false, onPatternClick }: Props = $props();

	interface PatternMetadata {
		name?: string;
		skill_sequence?: string[];
		applicable_to?: string[];
		success_rate?: number;
		usage_count?: number;
		mission_id?: string;
	}

	function getMetadata(pattern: Memory): PatternMetadata {
		return (pattern.metadata || {}) as PatternMetadata;
	}

	function formatSuccessRate(rate?: number): string {
		if (rate === undefined) return 'N/A';
		return `${Math.round(rate * 100)}%`;
	}
</script>

<div class="border border-surface-border bg-bg-secondary">
	<div class="p-4 border-b border-surface-border">
		<h3 class="font-medium text-text-primary flex items-center gap-2">
			Workflow Patterns
			{#if patterns.length > 0}
				<span class="text-xs font-mono text-text-tertiary">({patterns.length})</span>
			{/if}
		</h3>
		<p class="text-sm text-text-secondary mt-1">
			Successful skill sequences extracted from completed missions.
		</p>
	</div>

	{#if loading}
		<div class="p-8 text-center">
			<div class="animate-pulse text-text-tertiary font-mono text-sm">Loading patterns...</div>
		</div>
	{:else if patterns.length === 0}
		<div class="p-8 text-center">
			<div class="text-3xl mb-3 opacity-50">~</div>
			<p class="text-text-tertiary text-sm">No workflow patterns yet.</p>
			<p class="text-text-tertiary text-xs mt-1">
				Patterns are extracted from successful missions.
			</p>
		</div>
	{:else}
		<div class="divide-y divide-surface-border">
			{#each patterns.filter(p => p && p.content) as pattern}
				{@const meta = getMetadata(pattern)}
				<button
					class="w-full p-4 text-left hover:bg-bg-primary/50 transition-colors"
					onclick={() => onPatternClick?.(pattern)}
				>
					<!-- Pattern Header -->
					<div class="flex items-start justify-between gap-4 mb-3">
						<div>
							<h4 class="font-medium text-text-primary">
								{meta.name || pattern.content?.slice(0, 50) || 'Unnamed Pattern'}
							</h4>
							{#if pattern.content && pattern.content !== meta.name}
								<p class="text-sm text-text-secondary mt-1 line-clamp-2">
									{pattern.content}
								</p>
							{/if}
						</div>
						{#if meta.success_rate !== undefined}
							<div class="text-right shrink-0">
								<div class="text-lg font-mono text-green-400">
									{formatSuccessRate(meta.success_rate)}
								</div>
								<div class="text-xs text-text-tertiary">success</div>
							</div>
						{/if}
					</div>

					<!-- Skill Sequence -->
					{#if meta.skill_sequence && meta.skill_sequence.length > 0}
						<div class="mb-3">
							<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">
								Skill Flow
							</div>
							<div class="flex flex-wrap items-center gap-1">
								{#each meta.skill_sequence as skill, i}
									<span class="px-2 py-0.5 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10">
										{skill}
									</span>
									{#if i < meta.skill_sequence.length - 1}
										<span class="text-text-tertiary font-mono text-xs px-1">&rarr;</span>
									{/if}
								{/each}
							</div>
						</div>
					{/if}

					<!-- Applicable To Tags -->
					{#if meta.applicable_to && meta.applicable_to.length > 0}
						<div class="flex flex-wrap gap-1">
							{#each meta.applicable_to as tag}
								<span class="px-2 py-0.5 text-xs font-mono text-text-tertiary border border-surface-border">
									{tag}
								</span>
							{/each}
						</div>
					{/if}

					<!-- Usage Stats -->
					{#if meta.usage_count !== undefined}
						<div class="mt-2 text-xs text-text-tertiary">
							Used {meta.usage_count} time{meta.usage_count !== 1 ? 's' : ''}
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
