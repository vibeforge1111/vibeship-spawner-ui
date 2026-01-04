<script lang="ts">
	import { validateCanvas, getValidationSummary, type ValidationResult, type ValidationIssue } from '$lib/services/validation';
	import { nodes, connections, selectNode } from '$lib/stores/canvas.svelte';
	import type { CanvasNode, Connection } from '$lib/stores/canvas.svelte';

	interface Props {
		onClose: () => void;
	}

	let { onClose }: Props = $props();

	let currentNodes = $state<CanvasNode[]>([]);
	let currentConnections = $state<Connection[]>([]);
	let result = $state<ValidationResult | null>(null);

	$effect(() => {
		const unsub1 = nodes.subscribe((n) => (currentNodes = n));
		const unsub2 = connections.subscribe((c) => (currentConnections = c));
		return () => {
			unsub1();
			unsub2();
		};
	});

	$effect(() => {
		result = validateCanvas(currentNodes, currentConnections);
	});

	function getScoreColor(score: number): string {
		if (score >= 80) return 'text-accent-primary';
		if (score >= 50) return 'text-yellow-500';
		return 'text-red-500';
	}

	function getSeverityIcon(severity: ValidationIssue['severity']): string {
		switch (severity) {
			case 'error':
				return '!';
			case 'warning':
				return '⚠';
			case 'info':
				return 'i';
		}
	}

	function getSeverityColor(severity: ValidationIssue['severity']): string {
		switch (severity) {
			case 'error':
				return 'bg-red-500/20 text-red-400 border-red-500/50';
			case 'warning':
				return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
			case 'info':
				return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
		}
	}

	function handleIssueClick(issue: ValidationIssue) {
		if (issue.nodeId) {
			selectNode(issue.nodeId);
		}
	}
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={onClose} role="button" tabindex="-1">
	<div
		class="bg-bg-secondary border border-surface-border w-full max-w-lg max-h-[80vh] flex flex-col"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-surface-border">
			<h2 class="font-serif text-lg text-text-primary">Workflow Validation</h2>
			<button onclick={onClose} class="text-text-tertiary hover:text-text-primary">
				X
			</button>
		</div>

		{#if result}
			<!-- Score -->
			<div class="p-4 border-b border-surface-border">
				<div class="flex items-center justify-between mb-2">
					<span class="text-sm text-text-secondary">Validation Score</span>
					<span class="text-2xl font-mono {getScoreColor(result.score)}">{result.score}/100</span>
				</div>
				<div class="w-full h-2 bg-surface rounded-full overflow-hidden">
					<div
						class="h-full transition-all duration-300"
						class:bg-accent-primary={result.score >= 80}
						class:bg-yellow-500={result.score >= 50 && result.score < 80}
						class:bg-red-500={result.score < 50}
						style="width: {result.score}%"
					></div>
				</div>
				<p class="text-sm text-text-tertiary mt-2">{getValidationSummary(result)}</p>
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-3 gap-2 p-4 border-b border-surface-border text-center">
				<div>
					<div class="text-lg font-mono text-text-primary">{result.stats.totalNodes}</div>
					<div class="text-xs text-text-tertiary">Nodes</div>
				</div>
				<div>
					<div class="text-lg font-mono text-text-primary">{result.stats.totalConnections}</div>
					<div class="text-xs text-text-tertiary">Connections</div>
				</div>
				<div>
					<div class="text-lg font-mono text-text-primary">{result.stats.connectedNodes}</div>
					<div class="text-xs text-text-tertiary">Connected</div>
				</div>
			</div>

			<!-- Issues -->
			<div class="flex-1 overflow-y-auto p-4">
				{#if result.issues.length === 0}
					<div class="text-center py-8">
						<div class="text-3xl mb-2">✓</div>
						<p class="text-text-primary">No issues found</p>
						<p class="text-sm text-text-tertiary">Your workflow is ready to run</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each result.issues as issue (issue.id)}
							<button
								class="w-full text-left p-3 border {getSeverityColor(issue.severity)} transition-all hover:opacity-80"
								onclick={() => handleIssueClick(issue)}
							>
								<div class="flex items-start gap-2">
									<span class="font-mono text-sm w-5 h-5 flex items-center justify-center border rounded-full flex-shrink-0">
										{getSeverityIcon(issue.severity)}
									</span>
									<div class="flex-1 min-w-0">
										<p class="text-sm">{issue.message}</p>
										{#if issue.suggestion}
											<p class="text-xs opacity-70 mt-1">{issue.suggestion}</p>
										{/if}
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="p-4 border-t border-surface-border flex justify-between">
				<div class="text-xs text-text-tertiary">
					{result.stats.entryPoints} entry • {result.stats.exitPoints} exit
				</div>
				<button
					onclick={onClose}
					class="px-4 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				>
					Close
				</button>
			</div>
		{/if}
	</div>
</div>
