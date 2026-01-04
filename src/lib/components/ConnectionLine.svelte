<script lang="ts">
	import type { Connection, CanvasNode } from '$lib/stores/canvas.svelte';
	import { generatePorts, getPortColor } from '$lib/utils/ports';
	import type { PortType } from '$lib/types/skill';

	let {
		connection,
		nodes,
		nodeWidth = 192,
		nodeHeight = 48
	}: {
		connection: Connection;
		nodes: CanvasNode[];
		nodeWidth?: number;
		nodeHeight?: number;
	} = $props();

	const sourceNode = $derived(nodes.find((n) => n.id === connection.sourceNodeId));
	const targetNode = $derived(nodes.find((n) => n.id === connection.targetNodeId));

	// Get source port type for styling
	const sourcePortType = $derived((): PortType => {
		if (!sourceNode) return 'any';
		const ports = generatePorts({
			category: sourceNode.skill.category,
			handoffs: sourceNode.skill.handoffs,
			pairsWell: sourceNode.skill.pairsWell,
			tags: sourceNode.skill.tags
		});
		const port = ports.outputs.find(p => p.id === connection.sourcePortId);
		return port?.type || 'any';
	});

	// Get connection color based on source port type
	const connectionColor = $derived(getPortColor(sourcePortType()));

	// Get node heights based on port count
	const getNodeHeight = (node: CanvasNode) => {
		const ports = generatePorts({
			category: node.skill.category,
			handoffs: node.skill.handoffs,
			pairsWell: node.skill.pairsWell,
			tags: node.skill.tags
		});
		const maxPorts = Math.max(ports.inputs.length, ports.outputs.length);
		return Math.max(48, 20 + maxPorts * 18);
	};

	// Get port Y position within node
	const getPortY = (node: CanvasNode, portId: string, isOutput: boolean) => {
		const ports = generatePorts({
			category: node.skill.category,
			handoffs: node.skill.handoffs,
			pairsWell: node.skill.pairsWell,
			tags: node.skill.tags
		});
		const portList = isOutput ? ports.outputs : ports.inputs;
		const index = portList.findIndex(p => p.id === portId);
		const nodeH = getNodeHeight(node);
		const spacing = nodeH / (portList.length + 1);
		return spacing * (index + 1);
	};

	const pathD = $derived(() => {
		if (!sourceNode || !targetNode) return '';

		const sourceH = getNodeHeight(sourceNode);
		const targetH = getNodeHeight(targetNode);

		const startX = sourceNode.position.x + nodeWidth;
		const startY = sourceNode.position.y + getPortY(sourceNode, connection.sourcePortId, true);
		const endX = targetNode.position.x;
		const endY = targetNode.position.y + getPortY(targetNode, connection.targetPortId, false);

		const midX = (startX + endX) / 2;

		return 'M ' + startX + ' ' + startY +
			' C ' + midX + ' ' + startY + ', ' + midX + ' ' + endY + ', ' + endX + ' ' + endY;
	});

	// Connection style based on port type
	const connectionStyle = $derived(() => {
		const type = sourcePortType();
		switch (type) {
			case 'skill':
				return { dasharray: '4 4', width: 3 };
			case 'text':
				return { dasharray: '8 4', width: 2 };
			case 'object':
				return { dasharray: 'none', width: 2 };
			case 'array':
				return { dasharray: '2 2', width: 2 };
			case 'number':
				return { dasharray: '12 4', width: 2 };
			case 'boolean':
				return { dasharray: '6 2 2 2', width: 2 };
			default:
				return { dasharray: '8 4', width: 2 };
		}
	});
</script>

{#if sourceNode && targetNode}
	{@const style = connectionStyle()}
	{@const color = connectionColor}
	<g class="connection-group">
		<!-- Glow layer -->
		<path
			d={pathD()}
			fill="none"
			stroke={color}
			stroke-width={style.width + 4}
			stroke-dasharray={style.dasharray}
			class="connection-glow"
			opacity="0.2"
		/>
		<!-- Main connection line -->
		<path
			d={pathD()}
			fill="none"
			stroke={color}
			stroke-width={style.width}
			stroke-dasharray={style.dasharray}
			class="connection-line"
			class:animated={style.dasharray !== 'none'}
		/>
		<!-- Arrow marker at end -->
		<circle
			cx={targetNode.position.x}
			cy={targetNode.position.y + getPortY(targetNode, connection.targetPortId, false)}
			r="4"
			fill={color}
			class="connection-endpoint"
		/>
	</g>
{/if}

<style>
	.connection-group {
		pointer-events: none;
	}

	.connection-line {
		filter: drop-shadow(0 0 2px currentColor);
	}

	.connection-line.animated {
		animation: flow 1s linear infinite;
	}

	.connection-glow {
		filter: blur(4px);
	}

	.connection-endpoint {
		filter: drop-shadow(0 0 4px currentColor);
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
