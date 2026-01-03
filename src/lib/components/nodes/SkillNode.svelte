<script lang="ts">
	import type { SkillNodeData } from '$lib/types/skill';

	let {
		data,
		selected = false,
		ghost = false,
		collapsed = false,
		onSelect,
		onTest
	}: {
		data: SkillNodeData;
		selected?: boolean;
		ghost?: boolean;
		collapsed?: boolean;
		onSelect?: () => void;
		onTest?: () => void;
	} = $props();

	// Category color mapping
	const categoryColors: Record<string, string> = {
		development: 'bg-category-development',
		integration: 'bg-category-integration',
		ai: 'bg-category-ai',
		data: 'bg-category-data',
		marketing: 'bg-category-marketing',
		strategy: 'bg-category-strategy',
		agents: 'bg-category-agents',
		mind: 'bg-category-mind'
	};

	const categoryBadges: Record<string, string> = {
		development: 'category-development',
		integration: 'category-integration',
		ai: 'category-ai',
		data: 'category-data',
		marketing: 'category-marketing',
		strategy: 'category-strategy',
		agents: 'category-agents',
		mind: 'category-mind'
	};

	const categoryColor = categoryColors[data.category] || 'bg-surface-active';
	const badgeClass = categoryBadges[data.category] || '';
</script>

<div
	class="node w-64 select-none"
	class:selected
	class:ghost
	onclick={onSelect}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && onSelect?.()}
>
	<!-- Color accent bar -->
	<div class="h-1 {categoryColor} rounded-t-lg"></div>

	<!-- Node Header -->
	<div class="node-header">
		<span class="text-lg">{data.icon || '⚡'}</span>
		<div class="flex-1 min-w-0">
			<h3 class="text-sm font-medium text-text-primary truncate">{data.name}</h3>
			{#if !collapsed}
				<span class="badge {badgeClass} text-[10px]">{data.category}</span>
			{/if}
		</div>

		<!-- Test button -->
		<button
			onclick={(e) => { e.stopPropagation(); onTest?.(); }}
			class="btn-ghost p-1 rounded hover:bg-surface-active"
			title="Test this node"
		>
			<svg class="w-4 h-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
			</svg>
		</button>
	</div>

	{#if !collapsed}
		<!-- Node Body -->
		<div class="node-body">
			{#if data.description}
				<p class="text-xs text-text-secondary mb-3 line-clamp-2">{data.description}</p>
			{/if}

			<!-- Input Ports -->
			{#if data.inputs && data.inputs.length > 0}
				<div class="space-y-2 mb-3">
					{#each data.inputs as input}
						<div class="flex items-center gap-2">
							<div class="port port-{input.type}" title="{input.type}"></div>
							<span class="text-xs text-text-secondary">{input.label}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Output Ports -->
			{#if data.outputs && data.outputs.length > 0}
				<div class="space-y-2">
					{#each data.outputs as output}
						<div class="flex items-center justify-end gap-2">
							<span class="text-xs text-text-secondary">{output.label}</span>
							<div class="port port-{output.type}" title="{output.type}"></div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Sharp Edges Warning (if any) -->
		{#if data.sharpEdges && data.sharpEdges.length > 0}
			<div class="px-3 py-2 border-t border-surface-border bg-status-warning-bg/50">
				<div class="flex items-center gap-1.5 text-xs text-status-warning">
					<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
					<span>{data.sharpEdges.length} sharp edge{data.sharpEdges.length > 1 ? 's' : ''}</span>
				</div>
			</div>
		{/if}
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
