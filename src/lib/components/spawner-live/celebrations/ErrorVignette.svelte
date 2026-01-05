<script lang="ts">
	import { activeVignette } from '$lib/spawner-live/effects';
	import { fade } from 'svelte/transition';
</script>

{#if $activeVignette}
	<div
		class="vignette"
		class:pulse={$activeVignette.animation === 'pulse'}
		style="
			--vignette-color: {$activeVignette.color};
			--vignette-intensity: {$activeVignette.intensity};
		"
		in:fade={{ duration: 150 }}
		out:fade={{ duration: 300 }}
	></div>
{/if}

<style>
	.vignette {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 9997;
		box-shadow: inset 0 0 150px calc(var(--vignette-intensity, 0.3) * 100px)
			var(--vignette-color, #ef4444);
	}

	.vignette.pulse {
		animation: vignette-pulse 0.5s ease-in-out 2;
	}

	@keyframes vignette-pulse {
		0%,
		100% {
			box-shadow: inset 0 0 100px calc(var(--vignette-intensity, 0.3) * 80px)
				var(--vignette-color, #ef4444);
		}
		50% {
			box-shadow: inset 0 0 200px calc(var(--vignette-intensity, 0.3) * 120px)
				var(--vignette-color, #ef4444);
		}
	}
</style>
