<script lang="ts">
	import Icon from './Icon.svelte';
	import PipelineSelector from './PipelineSelector.svelte';
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
			<a href="/" class="flex items-center gap-1.5">
				<img src="/logo.png" alt="vibeship" class="w-6 h-6 -ml-0.5" />
				<span class="font-serif text-[1.36rem] text-text-primary" style="font-family: 'Instrument Serif', Georgia, serif;">vibeship</span>
				<span class="font-serif text-[1.36rem] text-accent-primary" style="font-family: 'Instrument Serif', Georgia, serif;">spawner</span>
			</a>
		</div>

		<div class="flex items-center gap-2">
			<a
				href="/canvas"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="grid" size={14} />
				<span class="hidden sm:inline">Canvas</span>
			</a>

			<a
				href="/missions"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="play" size={14} />
				<span class="hidden sm:inline">Missions</span>
			</a>

			<a
				href="/skills"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="layers" size={14} />
				<span class="hidden sm:inline">Skills</span>
			</a>

			<a
				href="/settings"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
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
