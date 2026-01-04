<script lang="ts">
	import { onMount } from 'svelte';
	import {
		pipelines,
		activePipeline,
		activePipelineId,
		createNewPipeline,
		switchPipeline,
		renamePipeline,
		duplicatePipeline,
		deletePipeline,
		type PipelineMetadata
	} from '$lib/stores/pipelines.svelte';
	import { get } from 'svelte/store';

	// Events
	interface Props {
		onSwitch?: (data: { nodes: any[]; connections: any[]; zoom: number; pan: { x: number; y: number } } | null) => void;
		onBeforeSwitch?: () => { nodes: any[]; connections: any[]; zoom: number; pan: { x: number; y: number } };
	}

	let { onSwitch, onBeforeSwitch }: Props = $props();

	let isOpen = $state(false);
	let isRenaming = $state<string | null>(null);
	let renameValue = $state('');
	let dropdownEl: HTMLDivElement;
	let renameInputEl: HTMLInputElement;

	// Get current values from stores
	let currentPipelines = $state<PipelineMetadata[]>([]);
	let currentActive = $state<PipelineMetadata | null>(null);

	// Subscribe to store changes
	$effect(() => {
		const unsubPipelines = pipelines.subscribe(v => currentPipelines = v);
		const unsubActive = activePipeline.subscribe(v => currentActive = v);
		return () => {
			unsubPipelines();
			unsubActive();
		};
	});

	// Close dropdown when clicking outside
	function handleClickOutside(e: MouseEvent) {
		if (dropdownEl && !dropdownEl.contains(e.target as Node)) {
			isOpen = false;
			isRenaming = null;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	function handleToggle(e: MouseEvent) {
		e.stopPropagation();
		isOpen = !isOpen;
		if (!isOpen) isRenaming = null;
	}

	function handleSelect(pipeline: PipelineMetadata) {
		if (pipeline.id === get(activePipelineId)) {
			isOpen = false;
			return;
		}

		// Get current canvas data before switching
		const currentData = onBeforeSwitch?.();

		// Switch to selected pipeline
		const newData = switchPipeline(pipeline.id);

		// Notify parent to update canvas
		onSwitch?.(newData);
		isOpen = false;
	}

	function handleCreate() {
		// Save current first
		onBeforeSwitch?.();

		const newPipeline = createNewPipeline();
		onSwitch?.({ nodes: [], connections: [], zoom: 1, pan: { x: 0, y: 0 } });
		isOpen = false;

		// Start renaming the new pipeline
		setTimeout(() => {
			isOpen = true;
			startRename(newPipeline);
		}, 100);
	}

	function startRename(pipeline: PipelineMetadata) {
		isRenaming = pipeline.id;
		renameValue = pipeline.name;
		setTimeout(() => renameInputEl?.focus(), 50);
	}

	function commitRename() {
		if (isRenaming && renameValue.trim()) {
			renamePipeline(isRenaming, renameValue.trim());
		}
		isRenaming = null;
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			commitRename();
		} else if (e.key === 'Escape') {
			isRenaming = null;
		}
	}

	function handleDuplicate(e: MouseEvent, pipeline: PipelineMetadata) {
		e.stopPropagation();
		duplicatePipeline(pipeline.id);
	}

	function handleDelete(e: MouseEvent, pipeline: PipelineMetadata) {
		e.stopPropagation();

		if (currentPipelines.length <= 1) {
			return; // Can't delete last pipeline
		}

		if (confirm(`Delete "${pipeline.name}"? This cannot be undone.`)) {
			const wasActive = pipeline.id === get(activePipelineId);
			deletePipeline(pipeline.id);

			if (wasActive) {
				// Load the new active pipeline
				const newActiveId = get(activePipelineId);
				if (newActiveId) {
					const data = switchPipeline(newActiveId);
					onSwitch?.(data);
				}
			}
		}
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString();
	}
</script>

<div class="relative" bind:this={dropdownEl}>
	<!-- Trigger button -->
	<button
		class="flex items-center gap-2 px-2.5 py-1.5 text-sm font-mono bg-bg-tertiary border border-surface-border hover:border-text-tertiary transition-all max-w-[200px]"
		onclick={handleToggle}
		title={currentActive?.name || 'Select pipeline'}
	>
		<svg class="w-4 h-4 text-accent-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
		</svg>
		<span class="truncate text-text-primary">{currentActive?.name || 'No pipeline'}</span>
		<svg class="w-3 h-3 text-text-tertiary shrink-0 transition-transform" class:rotate-180={isOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
		</svg>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div class="absolute top-full left-0 mt-1 w-72 bg-bg-secondary border border-surface-border shadow-xl z-50">
			<!-- Header -->
			<div class="px-3 py-2 border-b border-surface-border flex items-center justify-between">
				<span class="text-xs font-mono text-text-tertiary uppercase tracking-wide">Pipelines</span>
				<button
					class="text-xs font-mono text-accent-primary hover:text-accent-primary-hover transition-colors flex items-center gap-1"
					onclick={handleCreate}
				>
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
					</svg>
					New
				</button>
			</div>

			<!-- Pipeline list -->
			<div class="max-h-64 overflow-y-auto">
				{#each currentPipelines as pipeline (pipeline.id)}
					<div
						class="group px-3 py-2 hover:bg-bg-tertiary cursor-pointer border-b border-surface-border/50 last:border-b-0"
						class:bg-accent-primary-hover={pipeline.id === currentActive?.id}
						class:bg-opacity-10={pipeline.id === currentActive?.id}
						onclick={() => handleSelect(pipeline)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && handleSelect(pipeline)}
					>
						<div class="flex items-start justify-between gap-2">
							<!-- Pipeline info -->
							<div class="flex-1 min-w-0">
								{#if isRenaming === pipeline.id}
									<input
										bind:this={renameInputEl}
										bind:value={renameValue}
										class="w-full px-1.5 py-0.5 text-sm font-mono bg-bg-primary border border-accent-primary text-text-primary focus:outline-none"
										onclick={(e) => e.stopPropagation()}
										onblur={commitRename}
										onkeydown={handleRenameKeydown}
									/>
								{:else}
									<div class="flex items-center gap-1.5">
										{#if pipeline.id === currentActive?.id}
											<div class="w-1.5 h-1.5 rounded-full bg-accent-primary shrink-0"></div>
										{/if}
										<span class="text-sm font-mono text-text-primary truncate">{pipeline.name}</span>
									</div>
								{/if}
								<div class="flex items-center gap-2 mt-0.5 text-xs text-text-tertiary">
									<span>{pipeline.nodeCount} nodes</span>
									<span class="text-text-quaternary">·</span>
									<span>{formatDate(pipeline.updatedAt)}</span>
								</div>
							</div>

							<!-- Actions -->
							<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									class="p-1 text-text-tertiary hover:text-text-primary transition-colors"
									onclick={(e) => { e.stopPropagation(); startRename(pipeline); }}
									title="Rename"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
									</svg>
								</button>
								<button
									class="p-1 text-text-tertiary hover:text-text-primary transition-colors"
									onclick={(e) => handleDuplicate(e, pipeline)}
									title="Duplicate"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
									</svg>
								</button>
								{#if currentPipelines.length > 1}
									<button
										class="p-1 text-text-tertiary hover:text-red-400 transition-colors"
										onclick={(e) => handleDelete(e, pipeline)}
										title="Delete"
									>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
										</svg>
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>

			<!-- Empty state -->
			{#if currentPipelines.length === 0}
				<div class="px-3 py-6 text-center">
					<p class="text-sm text-text-tertiary">No pipelines yet</p>
					<button
						class="mt-2 text-sm text-accent-primary hover:underline"
						onclick={handleCreate}
					>
						Create your first pipeline
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Scrollbar styling */
	.max-h-64::-webkit-scrollbar {
		width: 6px;
	}

	.max-h-64::-webkit-scrollbar-track {
		background: transparent;
	}

	.max-h-64::-webkit-scrollbar-thumb {
		background: var(--color-surface-border);
		border-radius: 3px;
	}

	.max-h-64::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-tertiary);
	}
</style>
