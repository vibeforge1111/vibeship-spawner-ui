<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { particleSystem } from '$lib/spawner-live/effects';

	let canvas: HTMLCanvasElement;

	onMount(() => {
		if (canvas) {
			particleSystem.init(canvas);
		}
	});

	onDestroy(() => {
		particleSystem.destroy();
	});
</script>

<canvas bind:this={canvas} class="particle-canvas"></canvas>

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
