<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { theatreStore, theatreBridge, SceneManager, ROLE_NAMES, ROLE_COLORS } from '$lib/theatre';
	import type { AgentCharacter } from '$lib/theatre';
	import PipelineView from '$lib/theatre/components/PipelineView.svelte';
	import WorkflowGraph from '$lib/theatre/components/WorkflowGraph.svelte';
	import TaskTimeline from '$lib/theatre/components/TaskTimeline.svelte';

	let canvasContainer: HTMLDivElement;
	let activeView = $state<'stage' | 'pipeline' | 'timeline'>('stage');
	let sceneManager: SceneManager | null = null;

	// Reactive state from store
	let connected = $derived(theatreStore.connected);
	let missionName = $derived(theatreStore.missionName);
	let progress = $derived(theatreStore.progress);
	let characters = $derived(theatreStore.characters);
	let logs = $derived(theatreStore.logs);
	let activeCharacter = $derived(theatreStore.activeCharacter);

	onMount(() => {
		if (!browser || !canvasContainer) return;

		// Initialize Three.js scene
		sceneManager = new SceneManager(canvasContainer, {
			showGrid: true,
			showParticles: true,
			cameraMode: 'orbit',
			animationSpeed: 1
		});

		// Create character meshes for default agents
		for (const character of theatreStore.characters) {
			sceneManager.createCharacter(character);
		}

		// Start rendering
		sceneManager.start();

		// Connect bridge to receive mission events
		theatreBridge.connect();

		// Update loop for character animations
		const updateInterval = setInterval(() => {
			if (sceneManager) {
				for (const character of theatreStore.characters) {
					sceneManager.updateCharacter(character);
				}
			}
		}, 16); // ~60fps

		return () => {
			clearInterval(updateInterval);
		};
	});

	onDestroy(() => {
		if (sceneManager) {
			sceneManager.dispose();
			sceneManager = null;
		}
		theatreBridge.disconnect();
	});

	// Handle character click
	function handleCharacterClick(character: AgentCharacter) {
		console.log('Selected character:', character);
	}

	// Test simulation (dev only)
	function simulateTaskStart() {
		if (!theatreStore.connected) {
			theatreStore.connectToMission('test-mission', 'Test Mission');
		}
		theatreBridge.simulateEvent('task_started', {
			taskId: 'task-1',
			taskName: 'Database Schema Design'
		});
	}

	function simulateProgress() {
		theatreBridge.simulateEvent('progress', {
			taskId: 'task-1',
			progress: Math.min(100, theatreStore.progress + 20),
			message: 'Working on schema...'
		});
	}

	function simulateComplete() {
		theatreBridge.simulateEvent('task_completed', {
			taskId: 'task-1',
			data: { success: true }
		});
	}
</script>

<svelte:head>
	<title>Theatre | Spawner UI</title>
</svelte:head>

<div class="theatre-container">
	<!-- Header -->
	<header class="theatre-header">
		<div class="header-left">
			<h1>Spawner Theatre</h1>
			{#if missionName}
				<span class="mission-badge">{missionName}</span>
			{/if}
		</div>
		<div class="header-right">
			<div class="connection-status" class:connected>
				<span class="status-dot"></span>
				{connected ? 'Connected' : 'Disconnected'}
			</div>
			{#if progress > 0}
				<div class="progress-bar">
					<div class="progress-fill" style="width: {progress}%"></div>
					<span class="progress-text">{progress}%</span>
				</div>
			{/if}
		</div>
	</header>

	<!-- Main content -->
	<div class="theatre-main">
		<!-- View Content -->
		<div class="view-content">
			<!-- View Tabs -->
			<div class="view-tabs">
				<button
					class="view-tab"
					class:active={activeView === 'stage'}
					onclick={() => activeView = 'stage'}
				>
					<span class="tab-icon">◇</span>
					Stage
				</button>
				<button
					class="view-tab"
					class:active={activeView === 'pipeline'}
					onclick={() => activeView = 'pipeline'}
				>
					<span class="tab-icon">▤</span>
					Pipeline
				</button>
				<button
					class="view-tab"
					class:active={activeView === 'timeline'}
					onclick={() => activeView = 'timeline'}
				>
					<span class="tab-icon">▸</span>
					Timeline
				</button>
			</div>

			<!-- Stage View (3D) -->
			{#if activeView === 'stage'}
				<div class="canvas-wrapper" bind:this={canvasContainer}></div>
			{:else if activeView === 'pipeline'}
				<div class="pipeline-wrapper">
					<PipelineView />
				</div>
			{:else if activeView === 'timeline'}
				<div class="timeline-wrapper">
					<TaskTimeline maxItems={20} />
				</div>
			{/if}
		</div>

		<!-- Side Panel -->
		<aside class="side-panel">
			<!-- Workflow Graph (compact) -->
			<div class="panel-section workflow-graph-section">
				<h3>Workflow</h3>
				<WorkflowGraph compact={true} />
			</div>

			<!-- Active Agent -->
			{#if activeCharacter}
				<div class="panel-section active-agent">
					<h3>Active Agent</h3>
					<div class="agent-card" style="--agent-color: {activeCharacter.color}">
						<div class="agent-avatar">
							<div class="avatar-glow"></div>
						</div>
						<div class="agent-info">
							<span class="agent-name">{activeCharacter.name}</span>
							<span class="agent-task">{activeCharacter.currentTask || 'Working...'}</span>
						</div>
						<div class="agent-progress">
							<div class="mini-progress">
								<div class="mini-fill" style="width: {activeCharacter.progress}%"></div>
							</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- All Agents -->
			<div class="panel-section agents-list">
				<h3>Agents</h3>
				<div class="agents-grid">
					{#each characters as character}
						<button
							class="agent-chip"
							class:working={character.status === 'working'}
							class:celebrating={character.status === 'celebrating'}
							class:error={character.status === 'error'}
							style="--agent-color: {character.color}"
							onclick={() => handleCharacterClick(character)}
						>
							<span class="chip-dot"></span>
							<span class="chip-name">{character.name}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Activity Log -->
			<div class="panel-section activity-log">
				<h3>Activity</h3>
				<div class="log-list">
					{#each logs.slice(-10).reverse() as log}
						<div class="log-entry" class:success={log.type === 'success'} class:error={log.type === 'error'} class:handoff={log.type === 'handoff'}>
							<span class="log-time">{log.timestamp.toLocaleTimeString()}</span>
							<span class="log-message">{log.message}</span>
						</div>
					{/each}
					{#if logs.length === 0}
						<div class="log-empty">Waiting for activity...</div>
					{/if}
				</div>
			</div>

			<!-- Dev Controls (remove in production) -->
			<div class="panel-section dev-controls">
				<h3>Dev Controls</h3>
				<div class="dev-buttons">
					<button onclick={simulateTaskStart}>Start Task</button>
					<button onclick={simulateProgress}>Progress +20%</button>
					<button onclick={simulateComplete}>Complete</button>
				</div>
			</div>
		</aside>
	</div>
</div>

<style>
	.theatre-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background: var(--surface-primary, #0a0a0f);
		color: var(--text-primary, #e5e5e5);
	}

	/* Header */
	.theatre-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		background: var(--surface-secondary, #111116);
		border-bottom: 1px solid var(--surface-border, #1a1a2e);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.header-left h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
	}

	.mission-badge {
		padding: 0.25rem 0.75rem;
		background: var(--accent-primary, #00ffff);
		color: var(--surface-primary, #0a0a0f);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1.5rem;
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--text-secondary, #a0a0a0);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		background: #ef4444;
	}

	.connection-status.connected .status-dot {
		background: #10b981;
		box-shadow: 0 0 8px #10b981;
	}

	.progress-bar {
		position: relative;
		width: 200px;
		height: 24px;
		background: var(--surface-tertiary, #1a1a2e);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--accent-primary, #00ffff), var(--accent-secondary, #ff00ff));
		transition: width 0.3s ease;
	}

	.progress-text {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-size: 0.75rem;
		font-weight: 600;
	}

	/* Main */
	.theatre-main {
		display: flex;
		flex: 1;
		overflow: hidden;
	}

	.canvas-wrapper {
		flex: 1;
		position: relative;
	}

	/* Side Panel */
	.side-panel {
		width: 320px;
		background: var(--surface-secondary, #111116);
		border-left: 1px solid var(--surface-border, #1a1a2e);
		display: flex;
		flex-direction: column;
		overflow-y: auto;
	}

	.panel-section {
		padding: 1rem;
		border-bottom: 1px solid var(--surface-border, #1a1a2e);
	}

	.panel-section h3 {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary, #a0a0a0);
		margin: 0 0 0.75rem 0;
	}

	/* Active Agent Card */
	.agent-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--surface-tertiary, #1a1a2e);
	}

	.agent-avatar {
		width: 40px;
		height: 40px;
		background: var(--agent-color);
		position: relative;
	}

	.avatar-glow {
		position: absolute;
		inset: -4px;
		background: var(--agent-color);
		opacity: 0.3;
		filter: blur(8px);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 0.5; }
	}

	.agent-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.agent-name {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.agent-task {
		font-size: 0.75rem;
		color: var(--text-secondary, #a0a0a0);
	}

	.mini-progress {
		width: 60px;
		height: 4px;
		background: var(--surface-primary, #0a0a0f);
	}

	.mini-fill {
		height: 100%;
		background: var(--agent-color);
		transition: width 0.3s ease;
	}

	/* Agents Grid */
	.agents-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.agent-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: var(--surface-tertiary, #1a1a2e);
		border: 1px solid transparent;
		font-size: 0.75rem;
		color: var(--text-primary, #e5e5e5);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.agent-chip:hover {
		border-color: var(--agent-color);
	}

	.agent-chip.working {
		border-color: var(--agent-color);
		box-shadow: 0 0 8px color-mix(in srgb, var(--agent-color) 30%, transparent);
	}

	.agent-chip.celebrating {
		animation: celebrate 0.5s ease infinite alternate;
	}

	.agent-chip.error {
		border-color: #ef4444;
	}

	@keyframes celebrate {
		from { transform: translateY(0); }
		to { transform: translateY(-2px); }
	}

	.chip-dot {
		width: 6px;
		height: 6px;
		background: var(--agent-color);
	}

	/* Activity Log */
	.activity-log {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 200px;
	}

	.log-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.log-entry {
		display: flex;
		gap: 0.5rem;
		font-size: 0.75rem;
		padding: 0.375rem;
		background: var(--surface-tertiary, #1a1a2e);
	}

	.log-entry.success {
		border-left: 2px solid #10b981;
	}

	.log-entry.error {
		border-left: 2px solid #ef4444;
	}

	.log-entry.handoff {
		border-left: 2px solid #00ffff;
	}

	.log-time {
		color: var(--text-secondary, #a0a0a0);
		font-family: monospace;
	}

	.log-message {
		flex: 1;
	}

	.log-empty {
		color: var(--text-secondary, #a0a0a0);
		font-style: italic;
		text-align: center;
		padding: 1rem;
	}

	/* Dev Controls */
	.dev-controls {
		background: #1a0a0a;
		border-top: 1px solid #3a1a1a;
	}

	.dev-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.dev-buttons button {
		padding: 0.375rem 0.625rem;
		background: #2a1a1a;
		border: 1px solid #4a2a2a;
		color: #ff6666;
		font-size: 0.75rem;
		cursor: pointer;
	}

	.dev-buttons button:hover {
		background: #3a2a2a;
	}
</style>
