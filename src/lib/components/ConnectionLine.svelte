<script lang="ts">
	import type { Connection, CanvasNode } from '$lib/stores/canvas.svelte';

	let {
		connection,
		nodes,
		nodeWidth = 256,
		nodeHeight = 150
	}: {
		connection: Connection;
		nodes: CanvasNode[];
		nodeWidth?: number;
		nodeHeight?: number;
	} = $props();

	const sourceNode = $derived(nodes.find((n) => n.id === connection.sourceNodeId));
	const targetNode = $derived(nodes.find((n) => n.id === connection.targetNodeId));

	const pathD = $derived(() => {
		if (!sourceNode || !targetNode) return '';

		const startX = sourceNode.position.x + nodeWidth;
		const startY = sourceNode.position.y + nodeHeight / 2;
		const endX = targetNode.position.x;
		const endY = targetNode.position.y + nodeHeight / 2;

		const midX = (startX + endX) / 2;

		return 'M ' + startX + ' ' + startY +
			' C ' + midX + ' ' + startY + ', ' + midX + ' ' + endY + ', ' + endX + ' ' + endY;
	});
</script>

{#if sourceNode && targetNode}
	<path
		d={pathD()}
		fill="none"
		stroke="#00C49A"
		stroke-width="2"
		stroke-dasharray="8 4"
		class="connection-line"
		marker-end="url(#arrowhead)"
	/>
{/if}

<style>
	.connection-line {
		filter: drop-shadow(0 0 4px rgba(0, 196, 154, 0.4));
		animation: flow 1s linear infinite;
	}

	@keyframes flow {
		from {
			stroke-dashoffset: 24;
		}
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
