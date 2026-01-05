<script lang="ts">
	import { eventRouter, effectsEngine, particleSystem, celebration } from '$lib/spawner-live';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	// Get a random node ID from the canvas (if any)
	function getRandomNodeId(): string | null {
		const nodes = document.querySelectorAll('[data-node-id]');
		if (nodes.length === 0) return null;
		const randomIndex = Math.floor(Math.random() * nodes.length);
		return nodes[randomIndex].getAttribute('data-node-id');
	}

	// Get all node IDs
	function getAllNodeIds(): string[] {
		const nodes = document.querySelectorAll('[data-node-id]');
		return Array.from(nodes).map(n => n.getAttribute('data-node-id')).filter(Boolean) as string[];
	}

	// Event triggers
	function triggerAgentEnter() {
		const nodeId = getRandomNodeId();
		if (!nodeId) {
			console.warn('No nodes on canvas');
			return;
		}
		eventRouter.dispatch({
			type: 'agent_enter',
			nodeId,
			agentId: 'Test Agent',
			timestamp: Date.now()
		});
	}

	function triggerAgentProgress() {
		const nodeId = getRandomNodeId();
		if (!nodeId) return;

		let progress = 0;
		const interval = setInterval(() => {
			progress += 25;
			eventRouter.dispatch({
				type: 'agent_progress',
				nodeId,
				timestamp: Date.now(),
				data: { progress }
			});
			if (progress >= 100) {
				clearInterval(interval);
			}
		}, 500);
	}

	function triggerAgentThinking() {
		const nodeId = getRandomNodeId();
		if (!nodeId) return;
		eventRouter.dispatch({
			type: 'agent_thinking',
			nodeId,
			timestamp: Date.now()
		});
	}

	function triggerAgentExit() {
		const nodeId = getRandomNodeId();
		if (!nodeId) return;
		eventRouter.dispatch({
			type: 'agent_exit',
			nodeId,
			timestamp: Date.now()
		});
	}

	function triggerAgentError() {
		const nodeId = getRandomNodeId();
		if (!nodeId) return;
		eventRouter.dispatch({
			type: 'agent_error',
			nodeId,
			timestamp: Date.now(),
			data: { error: 'Test error message' }
		});
	}

	function triggerPipelineStart() {
		eventRouter.dispatch({
			type: 'pipeline_start',
			timestamp: Date.now()
		});
	}

	function triggerPipelineComplete() {
		eventRouter.dispatch({
			type: 'pipeline_complete',
			timestamp: Date.now()
		});
	}

	function triggerPipelineFailed() {
		eventRouter.dispatch({
			type: 'pipeline_failed',
			timestamp: Date.now(),
			data: { error: 'Test pipeline failure' }
		});
	}

	function triggerHandoff() {
		const nodeIds = getAllNodeIds();
		if (nodeIds.length < 2) {
			console.warn('Need at least 2 nodes for handoff');
			return;
		}
		const sourceId = nodeIds[0];
		const targetId = nodeIds[1];
		eventRouter.dispatch({
			type: 'handoff_start',
			nodeId: sourceId,
			timestamp: Date.now(),
			data: { targetNodeId: targetId }
		});
		setTimeout(() => {
			eventRouter.dispatch({
				type: 'handoff_complete',
				nodeId: targetId,
				timestamp: Date.now(),
				data: { sourceNodeId: sourceId }
			});
		}, 1000);
	}

	// Direct effect triggers
	function triggerConfetti() {
		celebration.confetti();
	}

	function triggerBanner(type: 'success' | 'info' | 'warning' | 'error') {
		const messages: Record<string, string> = {
			success: 'Mission Complete!',
			info: 'Pipeline Started',
			warning: 'Deviation Detected',
			error: 'Pipeline Failed'
		};
		celebration.showBanner(messages[type], type);
	}

	function triggerParticleBurst() {
		const nodeId = getRandomNodeId();
		if (!nodeId) return;
		particleSystem.burst(nodeId, {
			count: 50,
			color: ['#22c55e', '#3b82f6', '#f59e0b']
		});
	}

	// Full demo sequence
	async function runFullDemo() {
		const nodeIds = getAllNodeIds();
		if (nodeIds.length === 0) {
			console.warn('No nodes on canvas');
			return;
		}

		triggerPipelineStart();
		await new Promise(r => setTimeout(r, 1500));

		for (let i = 0; i < Math.min(3, nodeIds.length); i++) {
			const nodeId = nodeIds[i];

			// Enter node
			eventRouter.dispatch({
				type: 'agent_enter',
				nodeId,
				agentId: `Agent ${i + 1}`,
				timestamp: Date.now()
			});
			await new Promise(r => setTimeout(r, 500));

			// Progress
			for (let p = 0; p <= 100; p += 25) {
				eventRouter.dispatch({
					type: 'agent_progress',
					nodeId,
					timestamp: Date.now(),
					data: { progress: p }
				});
				await new Promise(r => setTimeout(r, 200));
			}

			// Exit
			eventRouter.dispatch({
				type: 'agent_exit',
				nodeId,
				timestamp: Date.now()
			});
			await new Promise(r => setTimeout(r, 500));

			// Handoff to next if available
			if (i < nodeIds.length - 1) {
				eventRouter.dispatch({
					type: 'handoff_start',
					nodeId,
					timestamp: Date.now(),
					data: { targetNodeId: nodeIds[i + 1] }
				});
				await new Promise(r => setTimeout(r, 800));
			}
		}

		triggerPipelineComplete();
	}
</script>

<div class="effects-test-panel">
	<div class="panel-header">
		<h3>Effects Test Panel</h3>
		{#if onClose}
			<button class="close-btn" onclick={onClose}>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="panel-content">
		<!-- Agent Events -->
		<div class="section">
			<h4>Agent Events</h4>
			<div class="button-grid">
				<button onclick={triggerAgentEnter}>Enter</button>
				<button onclick={triggerAgentProgress}>Progress</button>
				<button onclick={triggerAgentThinking}>Thinking</button>
				<button onclick={triggerAgentExit}>Exit</button>
				<button class="error" onclick={triggerAgentError}>Error</button>
			</div>
		</div>

		<!-- Pipeline Events -->
		<div class="section">
			<h4>Pipeline Events</h4>
			<div class="button-grid">
				<button onclick={triggerPipelineStart}>Start</button>
				<button class="success" onclick={triggerPipelineComplete}>Complete</button>
				<button class="error" onclick={triggerPipelineFailed}>Failed</button>
				<button onclick={triggerHandoff}>Handoff</button>
			</div>
		</div>

		<!-- Direct Effects -->
		<div class="section">
			<h4>Direct Effects</h4>
			<div class="button-grid">
				<button onclick={triggerConfetti}>Confetti</button>
				<button onclick={triggerParticleBurst}>Particle Burst</button>
				<button onclick={() => triggerBanner('success')}>Success Banner</button>
				<button onclick={() => triggerBanner('info')}>Info Banner</button>
				<button class="warning" onclick={() => triggerBanner('warning')}>Warn Banner</button>
				<button class="error" onclick={() => triggerBanner('error')}>Error Banner</button>
			</div>
		</div>

		<!-- Full Demo -->
		<div class="section">
			<h4>Demo</h4>
			<button class="demo-btn" onclick={runFullDemo}>
				Run Full Demo Sequence
			</button>
		</div>
	</div>
</div>

<style>
	.effects-test-panel {
		background: var(--bg-secondary, #1a1a24);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 8px;
		width: 280px;
		font-family: var(--font-mono, monospace);
		font-size: 12px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-tertiary, #666);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: var(--text-primary, #fff);
	}

	.panel-content {
		padding: 12px 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.section h4 {
		margin: 0 0 8px 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent-primary, #22c55e);
	}

	.button-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px;
	}

	button {
		padding: 6px 12px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	button:hover {
		background: var(--surface-border, #2a2a3a);
		border-color: var(--accent-primary, #22c55e);
	}

	button.success {
		border-color: var(--accent-primary, #22c55e);
		color: var(--accent-primary, #22c55e);
	}

	button.success:hover {
		background: var(--accent-primary, #22c55e);
		color: var(--bg-primary, #0f0f17);
	}

	button.warning {
		border-color: var(--color-yellow-500, #eab308);
		color: var(--color-yellow-500, #eab308);
	}

	button.warning:hover {
		background: var(--color-yellow-500, #eab308);
		color: var(--bg-primary, #0f0f17);
	}

	button.error {
		border-color: var(--status-error, #ef4444);
		color: var(--status-error, #ef4444);
	}

	button.error:hover {
		background: var(--status-error, #ef4444);
		color: white;
	}

	.demo-btn {
		width: 100%;
		padding: 10px;
		background: linear-gradient(135deg, var(--accent-primary, #22c55e), var(--accent-secondary, #3b82f6));
		border: none;
		color: white;
		font-weight: 600;
	}

	.demo-btn:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}
</style>
