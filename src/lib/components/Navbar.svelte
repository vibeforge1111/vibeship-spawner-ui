<script lang="ts">
	import Icon from './Icon.svelte';
	import PipelineSelector from './PipelineSelector.svelte';
	import BrandLogo from './BrandLogo.svelte';
	import { initPipelines } from '$lib/stores/pipelines.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let pipelinesReady = $state(false);

	onMount(() => {
		if (browser) {
			initPipelines();
			pipelinesReady = true;
		}
	});
</script>

<nav class="h-[52px] sticky top-0 border-b border-surface-border bg-bg-primary z-50">
	<div class="h-full max-w-6xl mx-auto flex items-center justify-between px-6">
		<div class="flex items-center gap-4">
			<BrandLogo size="sm" />
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/canvas"
				class="inline-flex items-center gap-2 px-3.5 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="grid" size={14} />
				<span class="hidden sm:inline">Canvas</span>
			</a>

			<a
				href="/kanban"
				class="inline-flex items-center gap-2 px-3.5 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="clipboard" size={14} />
				<span class="hidden sm:inline">Kanban</span>
			</a>

			<a
				href="/trace"
				class="inline-flex items-center gap-2 px-3.5 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="scan" size={14} />
				<span class="hidden sm:inline">Trace</span>
			</a>

			<a
				href="/skills"
				class="inline-flex items-center gap-2 px-3.5 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="layers" size={14} />
				<span class="hidden sm:inline">Skills</span>
			</a>

			<a
				href="/settings"
				class="inline-flex items-center gap-2 px-3.5 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="settings" size={14} />
				<span class="hidden sm:inline">Settings</span>
			</a>

			<div class="w-px h-5 bg-surface-border hidden md:block"></div>

			{#if pipelinesReady}
				<div class="hidden md:block">
					<PipelineSelector navigateOnSwitch={true} />
				</div>
			{/if}
		</div>
	</div>
</nav>
