<script lang="ts">
	import { agentIndicators } from '$lib/spawner-live/effects';

	interface Props {
		nodeId: string;
	}

	let { nodeId }: Props = $props();

	let indicator = $derived($agentIndicators.get(nodeId));
</script>

{#if indicator}
	<div class="agent-indicator" style="--indicator-color: {indicator.color}">
		<div class="indicator-orb"></div>
		<div class="indicator-ring"></div>
		<span class="agent-name">{indicator.agentId}</span>
	</div>
{/if}

<style>
	.agent-indicator {
		position: absolute;
		top: -8px;
		right: -8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
		z-index: 20;
	}

	.indicator-orb {
		width: 16px;
		height: 16px;
		background: var(--indicator-color, #8b5cf6);
		border-radius: 50%;
		box-shadow: 0 0 10px var(--indicator-color, #8b5cf6), 0 0 20px var(--indicator-color, #8b5cf6);
		animation: orb-pulse 1.5s ease-in-out infinite;
	}

	.indicator-ring {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 24px;
		height: 24px;
		border: 2px solid var(--indicator-color, #8b5cf6);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		animation: ring-expand 1.5s ease-out infinite;
		opacity: 0;
	}

	.agent-name {
		margin-top: 4px;
		padding: 2px 6px;
		background: var(--indicator-color, #8b5cf6);
		border-radius: 4px;
		font-size: 9px;
		font-weight: 600;
		color: white;
		white-space: nowrap;
		max-width: 80px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@keyframes orb-pulse {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.2);
			opacity: 0.8;
		}
	}

	@keyframes ring-expand {
		0% {
			width: 16px;
			height: 16px;
			opacity: 0.8;
		}
		100% {
			width: 32px;
			height: 32px;
			opacity: 0;
		}
	}
</style>
