<script lang="ts">
	import type { Connection, CanvasNode } from '$lib/stores/canvas.svelte';
	import { selectConnection, removeConnection } from '$lib/stores/canvas.svelte';
	import { generatePorts, getPortColor } from '$lib/utils/ports';
	import type { PortType } from '$lib/types/skill';

	let {
		connection,
		nodes,
		selected = false,
		nodeWidth = 192,
		nodeHeight = 48
	}: {
		connection: Connection;
		nodes: CanvasNode[];
		selected?: boolean;
		nodeWidth?: number;
		nodeHeight?: number;
	} = $props();

	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		selectConnection(connection.id);
	}

	function handleDelete(e: MouseEvent) {
		e.stopPropagation();
		removeConnection(connection.id);
	}

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

	// Port handle dimensions - must match SkillNode.svelte
	const PORT_OFFSET = 7; // How far ports stick out from node edge
	const PORT_SIZE = 12;  // Port handle width/height

	const pathD = $derived(() => {
		if (!sourceNode || !targetNode) return '';

		const sourceH = getNodeHeight(sourceNode);
		const targetH = getNodeHeight(targetNode);

		// Output port: right edge of node + offset to reach port center
		// Port sticks out 6px, is 10px wide, so center is at edge + (6 - 5) = edge + 1
		// But we want to connect at the outer edge of the port for cleaner look
		const startX = sourceNode.position.x + nodeWidth + PORT_OFFSET;
		const startY = sourceNode.position.y + getPortY(sourceNode, connection.sourcePortId, true);

		// Input port: left edge of node - offset to reach port center
		// Port sticks out 6px to the left
		const endX = targetNode.position.x - PORT_OFFSET;
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
	{@const color = selected ? '#fff' : connectionColor}
	<g class="connection-group" class:selected onclick={handleClick}>
		<!-- Invisible wider hit area for easier clicking -->
		<path
			d={pathD()}
			fill="none"
			stroke="transparent"
			stroke-width="16"
			class="connection-hitarea"
		/>
		<!-- Selection glow (when selected) -->
		{#if selected}
			<path
				d={pathD()}
				fill="none"
				stroke="#fff"
				stroke-width={style.width + 8}
				class="connection-selection-glow"
				opacity="0.3"
			/>
		{/if}
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
			stroke-width={selected ? style.width + 1 : style.width}
			stroke-dasharray={style.dasharray}
			class="connection-line"
			class:animated={style.dasharray !== 'none'}
		/>
		<!-- Arrow marker at end -->
		<circle
			cx={targetNode.position.x - PORT_OFFSET}
			cy={targetNode.position.y + getPortY(targetNode, connection.targetPortId, false)}
			r={selected ? 5 : 4}
			fill={color}
			class="connection-endpoint"
		/>
		<!-- Delete button on hover/selected -->
		{#if selected}
			{@const midX = (sourceNode.position.x + nodeWidth + PORT_OFFSET + targetNode.position.x - PORT_OFFSET) / 2}
			{@const midY = (sourceNode.position.y + getPortY(sourceNode, connection.sourcePortId, true) + targetNode.position.y + getPortY(targetNode, connection.targetPortId, false)) / 2}
			<g class="delete-button" transform="translate({midX}, {midY})" onclick={handleDelete} role="button" tabindex="0">
				<rect x="-8" y="-8" width="16" height="16" fill="var(--bg-secondary, #1a1a24)" stroke="var(--status-error, #ef4444)" stroke-width="1" class="delete-bg" />
				<path d="M-4,-4 L4,4 M-4,4 L4,-4" stroke="var(--status-error, #ef4444)" stroke-width="1.5" />
			</g>
		{/if}
	</g>
{/if}

<style>
	.connection-group {
		pointer-events: none;
		cursor: pointer;
	}

	.connection-hitarea {
		pointer-events: stroke;
	}

	.connection-group:hover .connection-line,
	.connection-group.selected .connection-line {
		filter: drop-shadow(0 0 4px currentColor);
	}

	.connection-line {
		filter: drop-shadow(0 0 2px currentColor);
		transition: stroke-width 0.15s;
	}

	.connection-line.animated {
		animation: flow 1s linear infinite;
	}

	.connection-glow {
		filter: blur(4px);
	}

	.connection-selection-glow {
		filter: blur(6px);
	}

	.connection-endpoint {
		filter: drop-shadow(0 0 4px currentColor);
		transition: r 0.15s;
	}

	.delete-button {
		pointer-events: all;
		cursor: pointer;
	}

	.delete-button:hover .delete-bg {
		fill: var(--status-error, #ef4444);
	}

	.delete-button:hover path {
		stroke: var(--bg-primary, #0f0f17);
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
