<script lang="ts">
	import type { PreMissionContext, PatternSuggestion, WarningSuggestion, TipSuggestion } from '$lib/services/pre-mission-context';
	import { getSeverityColor, getSeverityIcon, formatPattern, formatWarning, formatTip } from '$lib/services/pre-mission-context';

	interface Props {
		context: PreMissionContext | null;
		loading?: boolean;
		collapsed?: boolean;
		onToggle?: () => void;
		onApplyPattern?: (pattern: PatternSuggestion) => void;
	}

	let {
		context,
		loading = false,
		collapsed = false,
		onToggle,
		onApplyPattern
	}: Props = $props();

	// Derived values
	let hasContent = $derived(
		context && (
			context.suggestedPatterns.length > 0 ||
			context.warnings.length > 0 ||
			context.tips.length > 0
		)
	);

	let totalItems = $derived(
		(context?.suggestedPatterns.length || 0) +
		(context?.warnings.length || 0) +
		(context?.tips.length || 0)
	);
</script>

<!-- Mind Suggestions Panel -->
<div class="border border-surface-border bg-bg-tertiary/50">
	<!-- Header (always visible) -->
	<button
		onclick={onToggle}
		class="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-hover transition-colors"
	>
		<div class="flex items-center gap-2">
			<svg class="w-4 h-4 text-accent-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
			</svg>
			<span class="text-xs font-mono text-text-secondary">Mind Suggestions</span>
			{#if totalItems > 0}
				<span class="px-1.5 py-0.5 text-[10px] font-mono bg-accent-secondary/20 text-accent-secondary rounded-sm">
					{totalItems}
				</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if loading}
				<span class="animate-pulse text-xs text-text-tertiary">Loading...</span>
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

	<!-- Content (collapsible) -->
	{#if !collapsed && context}
		<div class="px-3 pb-3 space-y-3">
			{#if context.error}
				<!-- Error state -->
				<div class="text-xs text-red-400 py-2">
					{context.error}
				</div>
			{:else if !hasContent}
				<!-- Empty state -->
				<div class="text-xs text-text-tertiary py-2">
					No past learnings found for this workflow. Run missions to build knowledge.
				</div>
			{:else}
				<!-- Suggested Patterns -->
				{#if context.suggestedPatterns.length > 0}
					<div class="space-y-1.5">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
							Suggested Patterns
						</div>
						{#each context.suggestedPatterns as pattern}
							<button
								onclick={() => onApplyPattern?.(pattern)}
								class="w-full text-left p-2 border border-accent-primary/30 bg-accent-primary/5 hover:bg-accent-primary/10 transition-colors group"
							>
								<div class="flex items-start gap-2">
									<span class="text-accent-primary text-sm">✓</span>
									<div class="flex-1 min-w-0">
										<p class="text-xs text-text-primary line-clamp-2">{pattern.content}</p>
										<div class="flex items-center gap-2 mt-1">
											{#if pattern.skillSequence.length > 0}
												<span class="text-[10px] text-text-tertiary font-mono">
													{pattern.skillSequence.slice(0, 3).join(' → ')}
													{#if pattern.skillSequence.length > 3}...{/if}
												</span>
											{/if}
											<span class="text-[10px] text-accent-primary font-mono">
												{Math.round(pattern.successRate * 100)}% success
											</span>
										</div>
									</div>
									<span class="text-[10px] text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
										Apply
									</span>
								</div>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Warnings -->
				{#if context.warnings.length > 0}
					<div class="space-y-1.5">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
							Watch Out
						</div>
						{#each context.warnings as warning}
							<div class="p-2 border {getSeverityColor(warning.severity)}">
								<div class="flex items-start gap-2">
									<span class="text-sm">{getSeverityIcon(warning.severity)}</span>
									<p class="text-xs flex-1 line-clamp-2">{warning.content}</p>
								</div>
								{#if warning.skillId}
									<div class="mt-1 ml-6">
										<span class="text-[10px] font-mono text-text-tertiary">
											Related to: {warning.skillId}
										</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Tips -->
				{#if context.tips.length > 0}
					<div class="space-y-1.5">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
							Tips
						</div>
						{#each context.tips as tip}
							<div class="p-2 border border-surface-border bg-surface/50">
								<div class="flex items-start gap-2">
									<span class="text-blue-400 text-sm">💡</span>
									<div class="flex-1 min-w-0">
										<p class="text-xs text-text-secondary line-clamp-2">{tip.content}</p>
										<span class="text-[10px] font-mono text-text-tertiary mt-1 block">
											from {tip.source}
										</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
