<script lang="ts">
	import SkillNode from '$lib/components/nodes/SkillNode.svelte';
	import type { SkillNodeData } from '$lib/types/skill';

	// Demo nodes for initial display
	const demoNodes: SkillNodeData[] = [
		{
			id: '1',
			name: 'GitHub Watch',
			description: 'Listen for repository events like stars, forks, and issues',
			icon: '🐙',
			category: 'integration',
			outputs: [
				{ id: 'event', label: 'Event Data', type: 'object' }
			],
			sharpEdges: [
				{ id: '1', message: 'Rate limits apply after 5000 requests/hour', severity: 'warning' }
			]
		},
		{
			id: '2',
			name: 'Filter',
			description: 'Filter data based on conditions',
			icon: '🔍',
			category: 'data',
			inputs: [
				{ id: 'data', label: 'Input Data', type: 'object' }
			],
			outputs: [
				{ id: 'passed', label: 'Passed', type: 'object' },
				{ id: 'failed', label: 'Failed', type: 'object' }
			]
		},
		{
			id: '3',
			name: 'Send Email',
			description: 'Send emails via SMTP or API',
			icon: '📧',
			category: 'integration',
			inputs: [
				{ id: 'to', label: 'Recipient', type: 'text' },
				{ id: 'subject', label: 'Subject', type: 'text' },
				{ id: 'body', label: 'Body', type: 'text' }
			],
			outputs: [
				{ id: 'result', label: 'Result', type: 'object' }
			]
		}
	];

	let selectedNodeId = $state<string | null>(null);
	let chatInput = $state('');

	function handleNodeSelect(nodeId: string) {
		selectedNodeId = selectedNodeId === nodeId ? null : nodeId;
	}

	function handleNodeTest(nodeId: string) {
		console.log('Testing node:', nodeId);
		// TODO: Open test panel
	}
</script>

<div class="h-screen flex bg-bg-primary">
	<!-- Sidebar / Mind Panel -->
	<aside class="w-64 border-r border-surface-border bg-bg-secondary flex flex-col">
		<div class="p-4 border-b border-surface-border">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-vibe-cyan-glow border border-vibe-cyan-border flex items-center justify-center">
					<span class="text-accent-primary text-lg">⚡</span>
				</div>
				<div>
					<span class="font-display font-semibold text-text-primary">spawner</span>
					<p class="text-xs font-mono text-accent-primary">spawn()</p>
				</div>
			</div>
		</div>

		<!-- Mode Switcher -->
		<div class="p-4 border-b border-surface-border">
			<div class="flex gap-1 p-1 bg-bg-tertiary rounded-lg">
				<button class="flex-1 py-1.5 text-sm font-medium rounded bg-accent-primary text-white">
					Express
				</button>
				<button class="flex-1 py-1.5 text-sm font-medium rounded text-text-secondary hover:text-text-primary">
					Studio
				</button>
				<button class="flex-1 py-1.5 text-sm font-medium rounded text-text-secondary hover:text-text-primary">
					Code
				</button>
			</div>
		</div>

		<!-- Mind Panel -->
		<div class="flex-1 p-4 overflow-y-auto">
			<div class="flex items-center justify-between mb-3">
				<span class="font-mono text-accent-primary text-sm">recall()</span>
				<span class="text-xs font-mono text-text-tertiary">01</span>
			</div>
			<div class="space-y-2">
				<div class="p-3 rounded-lg bg-surface border border-surface-border hover:border-vibe-cyan-border transition-colors">
					<p class="text-xs text-text-secondary">No memories yet. Your decisions and learnings will appear here.</p>
				</div>
			</div>
		</div>

		<!-- Project Info -->
		<div class="p-4 border-t border-surface-border">
			<div class="text-xs text-text-tertiary">
				<span>Untitled Project</span>
				<span class="mx-2">•</span>
				<span>Draft</span>
			</div>
		</div>
	</aside>

	<!-- Main Canvas Area -->
	<main class="flex-1 flex flex-col">
		<!-- Toolbar -->
		<header class="h-12 border-b border-surface-border bg-bg-secondary flex items-center px-4 gap-4">
			<div class="flex items-center gap-2">
				<button class="btn-ghost btn-sm">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>
				<span class="text-sm text-text-secondary">3 nodes</span>
			</div>

			<div class="flex-1"></div>

			<div class="flex items-center gap-2">
				<button class="btn-secondary btn-sm">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Validate
				</button>
				<button class="btn-primary btn-sm">
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Run
				</button>
			</div>
		</header>

		<!-- Canvas -->
		<div class="flex-1 relative overflow-hidden bg-bg-primary">
			<!-- Grid Background -->
			<div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, #2a2a38 1px, transparent 1px); background-size: 24px 24px;"></div>

			<!-- Demo Nodes (positioned manually for now) -->
			<div class="absolute inset-0 p-8">
				<div class="flex gap-8 items-start">
					{#each demoNodes as node}
						<SkillNode
							data={node}
							selected={selectedNodeId === node.id}
							onSelect={() => handleNodeSelect(node.id)}
							onTest={() => handleNodeTest(node.id)}
						/>
					{/each}
				</div>

				<!-- Connection lines (demo) -->
				<svg class="absolute inset-0 pointer-events-none" style="z-index: -1;">
					<defs>
						<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
							<polygon points="0 0, 10 3.5, 0 7" fill="#00d4ff" />
						</marker>
						<!-- Glow filter for connections -->
						<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
							<feGaussianBlur stdDeviation="3" result="coloredBlur"/>
							<feMerge>
								<feMergeNode in="coloredBlur"/>
								<feMergeNode in="SourceGraphic"/>
							</feMerge>
						</filter>
					</defs>
					<!-- Line from GitHub to Filter -->
					<path
						d="M 280 100 C 340 100, 300 100, 360 100"
						fill="none"
						stroke="#00d4ff"
						stroke-width="2"
						stroke-dasharray="8 4"
						class="connection-flow"
						filter="url(#glow)"
						marker-end="url(#arrowhead)"
					/>
					<!-- Line from Filter to Email -->
					<path
						d="M 568 100 C 628 100, 588 100, 648 100"
						fill="none"
						stroke="#00d4ff"
						stroke-width="2"
						stroke-dasharray="8 4"
						class="connection-flow"
						filter="url(#glow)"
						marker-end="url(#arrowhead)"
					/>
				</svg>
			</div>
		</div>

		<!-- Chat Input (Bottom) -->
		<div class="border-t border-surface-border bg-bg-secondary p-4">
			<div class="max-w-2xl mx-auto">
				<div class="relative">
					<input
						type="text"
						bind:value={chatInput}
						placeholder="Ask Claude to modify this workflow..."
						class="input pr-24"
					/>
					<button class="absolute right-2 top-1/2 -translate-y-1/2 btn-primary btn-sm">
						Send
					</button>
				</div>
				<p class="text-xs text-text-tertiary mt-2 text-center">
					Try: "Add error handling" or "Connect to Slack instead of email"
				</p>
			</div>
		</div>
	</main>

	<!-- Right Panel (Node Details / Test Panel) -->
	{#if selectedNodeId}
		{@const selectedNode = demoNodes.find(n => n.id === selectedNodeId)}
		{#if selectedNode}
			<aside class="w-80 border-l border-surface-border bg-bg-secondary flex flex-col animate-slide-up">
				<div class="p-4 border-b border-surface-border flex items-center justify-between">
					<h2 class="font-medium text-text-primary">{selectedNode.name}</h2>
					<button onclick={() => selectedNodeId = null} class="btn-ghost p-1 rounded">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-4">
					<!-- Description -->
					<div class="mb-6">
						<h3 class="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">Description</h3>
						<p class="text-sm text-text-secondary">{selectedNode.description}</p>
					</div>

					<!-- Sharp Edges -->
					{#if selectedNode.sharpEdges && selectedNode.sharpEdges.length > 0}
						<div class="mb-6">
							<h3 class="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">Sharp Edges</h3>
							{#each selectedNode.sharpEdges as edge}
								<div class="p-3 rounded-lg bg-status-warning-bg border border-status-warning/20 mb-2">
									<p class="text-sm text-status-warning">{edge.message}</p>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Configuration -->
					<div class="mb-6">
						<h3 class="text-xs font-semibold text-text-tertiary uppercase tracking-wide mb-2">Configuration</h3>
						<div class="space-y-3">
							<div>
								<label class="block text-xs text-text-secondary mb-1">Repository</label>
								<input type="text" class="input text-sm" placeholder="owner/repo" />
							</div>
							<div>
								<label class="block text-xs text-text-secondary mb-1">Events</label>
								<select class="input text-sm">
									<option>star</option>
									<option>fork</option>
									<option>issue</option>
									<option>push</option>
								</select>
							</div>
						</div>
					</div>
				</div>

				<!-- Test Button -->
				<div class="p-4 border-t border-surface-border">
					<button class="btn-secondary btn-md w-full">
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
						Test Node
					</button>
				</div>
			</aside>
		{/if}
	{/if}
</div>
