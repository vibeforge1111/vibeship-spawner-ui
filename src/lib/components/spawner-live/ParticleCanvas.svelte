<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { particleSystem } from '$lib/spawner-live/effects';

	interface Props {
		canvas?: HTMLCanvasElement | null;
	}

	let { canvas = $bindable(null) }: Props = $props();
	let internalCanvas: HTMLCanvasElement;

	// Expose the canvas element via bindable prop
	$effect(() => {
		if (internalCanvas) {
			canvas = internalCanvas;
		}
	});

	onMount(() => {
		if (internalCanvas) {
			particleSystem.init(internalCanvas);
		}
	});

	onDestroy(() => {
		particleSystem.destroy();
	});
</script>

<canvas bind:this={internalCanvas} class="particle-canvas"></canvas>

<style>
	.particle-canvas {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 9998;
	}
</style>
