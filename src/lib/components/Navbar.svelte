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
	<div class="h-full max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6">
		<div class="flex items-center gap-4">
			<BrandLogo size="sm" />
		</div>

		<div class="flex items-center gap-1 sm:gap-2">
			<a
				href="/canvas"
				class="nav-pop group inline-flex items-center gap-2 px-2 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md sm:px-3.5"
			>
				<Icon name="grid" size={14} class="nav-pop-icon" />
				<span class="nav-pop-label hidden sm:inline">Canvas</span>
			</a>

			<a
				href="/kanban"
				class="nav-pop group inline-flex items-center gap-2 px-2 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md sm:px-3.5"
			>
				<Icon name="clipboard" size={14} class="nav-pop-icon" />
				<span class="nav-pop-label hidden sm:inline">Kanban</span>
			</a>

			<a
				href="/trace"
				class="nav-pop group inline-flex items-center gap-2 px-2 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md sm:px-3.5"
			>
				<Icon name="scan" size={14} class="nav-pop-icon" />
				<span class="nav-pop-label hidden sm:inline">Trace</span>
			</a>

			<a
				href="/skills"
				class="nav-pop group inline-flex items-center gap-2 px-2 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md sm:px-3.5"
			>
				<Icon name="layers" size={14} class="nav-pop-icon" />
				<span class="nav-pop-label hidden sm:inline">Skills</span>
			</a>

			<a
				href="/settings"
				class="nav-pop group inline-flex items-center gap-2 px-2 py-2 font-sans text-[15px] font-medium text-text-secondary border border-transparent rounded-md sm:px-3.5"
			>
				<Icon name="settings" size={14} class="nav-pop-icon" />
				<span class="nav-pop-label hidden sm:inline">Settings</span>
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

<style>
	.nav-pop {
		position: relative;
		overflow: hidden;
		isolation: isolate;
		transition:
			background-color 220ms cubic-bezier(0.23, 1, 0.32, 1),
			border-color 220ms cubic-bezier(0.23, 1, 0.32, 1),
			color 220ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.nav-pop::before {
		content: '';
		position: absolute;
		inset: auto 10px 4px;
		height: 2px;
		border-radius: 999px;
		background: var(--accent);
		opacity: 0;
		transform: scaleX(0.35);
		transform-origin: center;
		transition:
			opacity 220ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.nav-pop::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			linear-gradient(135deg, rgb(var(--accent-rgb) / 0.12), transparent 56%),
			rgb(var(--bg-subtle-rgb) / 0.62);
		opacity: 0;
		transition: opacity 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.nav-pop:hover {
		color: var(--text);
		border-color: rgb(var(--accent-rgb) / 0.34);
		transform: translateY(-1px);
	}

	.nav-pop:hover::before,
	.nav-pop:hover::after {
		opacity: 1;
		transform: scaleX(1);
	}

	.nav-pop:active {
		transform: translateY(0) scale(0.97);
		transition-duration: 100ms;
	}

	:global(.nav-pop-icon) {
		position: relative;
		z-index: 1;
		transition:
			color 260ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 260ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.nav-pop:hover :global(.nav-pop-icon) {
		color: var(--accent);
		transform: scale(1.12) rotate(-10deg);
	}

	.nav-pop-label {
		position: relative;
		z-index: 1;
		transition: transform 260ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.nav-pop:hover .nav-pop-label {
		transform: translateX(2px);
	}
</style>
