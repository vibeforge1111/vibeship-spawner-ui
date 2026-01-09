<script lang="ts">
	import { onMount } from 'svelte';
	import { memoryClient, type SelfImprovementMetrics, type DecisionTraceResponse, type PatternResponse } from '$lib/services/memory-client';

	let metrics = $state<SelfImprovementMetrics | null>(null);
	let decisionTraces = $state<DecisionTraceResponse[]>([]);
	let patterns = $state<PatternResponse[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		loading = true;
		error = null;

		try {
			// Load all LITE+ data in parallel
			const [metricsResult, tracesResult, patternsResult] = await Promise.all([
				memoryClient.getSelfImprovementMetrics(),
				memoryClient.listDecisionTraces({ limit: 20 }),
				memoryClient.listPatterns()
			]);

			if (metricsResult.success && metricsResult.data) {
				metrics = metricsResult.data;
			}
			if (tracesResult.success && tracesResult.data) {
				decisionTraces = tracesResult.data;
			}
			if (patternsResult.success && patternsResult.data?.patterns) {
				patterns = patternsResult.data.patterns;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load LITE+ data';
		}

		loading = false;
	}

	async function triggerPatternExtraction() {
		const result = await memoryClient.extractPatterns(2);
		if (result.success && result.data) {
			alert(`Extracted ${result.data.extracted} new patterns!`);
			await loadData();
		}
	}

	function formatDate(dateStr: string): string {
		const utcDateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
		const date = new Date(utcDateStr);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getQualityColor(quality: number | null | undefined): string {
		if (quality === null || quality === undefined) return 'text-text-tertiary';
		if (quality > 0.5) return 'text-green-400';
		if (quality > 0) return 'text-yellow-400';
		return 'text-red-400';
	}

	function getQualityLabel(quality: number | null | undefined): string {
		if (quality === null || quality === undefined) return 'Pending';
		if (quality > 0.5) return 'Success';
		if (quality > 0) return 'Partial';
		return 'Failed';
	}
</script>

{#if loading}
	<div class="border border-surface-border bg-bg-secondary p-12 text-center">
		<div class="animate-pulse text-text-tertiary font-mono">Loading LITE+ intelligence data...</div>
	</div>
{:else if error}
	<div class="border border-red-500/30 bg-red-500/10 p-6">
		<p class="text-red-400 font-mono text-sm">{error}</p>
		<p class="text-text-tertiary text-xs mt-2">Make sure Mind LITE+ API is running with decision tracing enabled.</p>
	</div>
{:else}
	<!-- Metrics Overview Cards -->
	{#if metrics}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-3xl font-mono text-accent-primary">{metrics.totalDecisions}</div>
				<div class="text-xs text-text-tertiary font-mono mt-1">Decision Traces</div>
			</div>
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-3xl font-mono text-green-400">{(metrics.successRate * 100).toFixed(0)}%</div>
				<div class="text-xs text-text-tertiary font-mono mt-1">Success Rate</div>
			</div>
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-3xl font-mono text-purple-400">{metrics.memoriesAttributed}</div>
				<div class="text-xs text-text-tertiary font-mono mt-1">Memories Attributed</div>
			</div>
			<div class="border border-surface-border bg-bg-secondary p-4">
				<div class="text-3xl font-mono text-yellow-400">{metrics.topPatterns.length}</div>
				<div class="text-xs text-text-tertiary font-mono mt-1">Patterns Extracted</div>
			</div>
		</div>

		<!-- Attribution Formula -->
		<div class="border border-accent-secondary/30 bg-accent-secondary/5 p-4 mb-8">
			<h3 class="font-mono text-sm text-accent-secondary mb-2">LITE+ Attribution Formula</h3>
			<code class="text-text-primary font-mono text-sm">
				delta = quality x contribution x 0.1
			</code>
			<p class="text-xs text-text-tertiary mt-2">
				When a decision has an outcome, each source memory's salience is adjusted based on how much it contributed.
				Quality: -1 (failure) to +1 (success). Net salience change: <span class="text-accent-primary">{metrics.salienceChanges.netChange.toFixed(3)}</span>
			</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Decision Traces -->
		<div>
			<h2 class="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
				<span class="font-mono text-accent-secondary text-sm">[~]</span>
				Decision Traces
				<span class="text-xs text-text-tertiary font-mono">({decisionTraces.length})</span>
			</h2>

			{#if decisionTraces.length === 0}
				<div class="border border-surface-border bg-bg-secondary p-6 text-center">
					<p class="text-text-tertiary font-mono text-sm">No decision traces yet</p>
					<p class="text-xs text-text-tertiary mt-2">Run a mission to create decision traces with memory attribution.</p>
				</div>
			{:else}
				<div class="space-y-2 max-h-[400px] overflow-y-auto">
					{#each decisionTraces as trace}
						<div class="border border-surface-border bg-bg-secondary p-3">
							<div class="flex items-start justify-between gap-2 mb-2">
								<div class="flex items-center gap-2">
									<span class="font-mono text-xs text-text-tertiary">{trace.trace_id.slice(0, 8)}...</span>
									<span class="px-1.5 py-0.5 text-xs font-mono border {getQualityColor(trace.outcome_quality)} border-current/30">
										{getQualityLabel(trace.outcome_quality)}
									</span>
								</div>
								<span class="text-xs text-text-tertiary font-mono">{formatDate(trace.created_at)}</span>
							</div>

							<div class="text-sm text-text-primary mb-2">
								{trace.decision_summary?.split('\n')[0] || trace.decision_type || 'Decision'}
							</div>

							<div class="flex items-center gap-4 text-xs text-text-tertiary font-mono">
								<span title="Memories linked to this decision">
									<span class="text-purple-400">{trace.memory_ids.length}</span> memories
								</span>
								<span title="Confidence level">
									<span class="text-yellow-400">{(trace.confidence * 100).toFixed(0)}%</span> confidence
								</span>
								{#if trace.outcome_quality !== null}
									<span title="Outcome quality (-1 to +1)">
										<span class="{getQualityColor(trace.outcome_quality)}">{trace.outcome_quality?.toFixed(2)}</span> quality
									</span>
								{/if}
							</div>

							<!-- Show reasoning if present -->
							{#if trace.decision_summary?.includes('Reasoning:')}
								<div class="mt-2 pt-2 border-t border-surface-border">
									<p class="text-xs text-text-tertiary italic">
										{trace.decision_summary.split('Reasoning:')[1]?.trim().slice(0, 100)}...
									</p>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Extracted Patterns -->
		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-medium text-text-primary flex items-center gap-2">
					<span class="font-mono text-accent-secondary text-sm">[*]</span>
					Extracted Patterns
					<span class="text-xs text-text-tertiary font-mono">({patterns.length})</span>
				</h2>
				<button
					onclick={triggerPatternExtraction}
					class="px-3 py-1 text-xs font-mono border border-surface-border text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-all"
				>
					Extract Now
				</button>
			</div>

			{#if patterns.length === 0}
				<div class="border border-surface-border bg-bg-secondary p-6 text-center">
					<p class="text-text-tertiary font-mono text-sm">No patterns extracted yet</p>
					<p class="text-xs text-text-tertiary mt-2">Patterns emerge from repeated successful decision types.</p>
				</div>
			{:else}
				<div class="space-y-2 max-h-[400px] overflow-y-auto">
					{#each patterns as pattern}
						<div class="border border-green-500/30 bg-green-500/5 p-3">
							<div class="flex items-start justify-between gap-2 mb-2">
								<h3 class="font-medium text-text-primary text-sm">
									{pattern.pattern_name || pattern.pattern_id.slice(0, 12)}
								</h3>
								<span class="px-1.5 py-0.5 text-xs font-mono bg-green-500/20 text-green-400 border border-green-500/30">
									{(pattern.success_rate * 100).toFixed(0)}% success
								</span>
							</div>

							{#if pattern.description}
								<p class="text-xs text-text-secondary mb-2">{pattern.description}</p>
							{/if}

							<div class="flex items-center gap-4 text-xs text-text-tertiary font-mono">
								<span title="Number of decisions that support this pattern">
									<span class="text-purple-400">{pattern.evidence_count}</span> evidence
								</span>
								{#if pattern.skill_sequence?.length}
									<span title="Skill sequence">
										{pattern.skill_sequence.join(' -> ')}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- How It Works -->
	<div class="mt-8 border border-surface-border bg-bg-secondary p-4">
		<h3 class="font-mono text-sm text-text-primary mb-3">How LITE+ Self-Improvement Works</h3>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
			<div class="flex gap-2">
				<span class="text-accent-primary font-mono">1.</span>
				<div>
					<p class="text-text-primary font-medium">Decision Trace Created</p>
					<p class="text-text-tertiary">When a task starts, relevant past memories are found and linked to a new decision trace.</p>
				</div>
			</div>
			<div class="flex gap-2">
				<span class="text-accent-primary font-mono">2.</span>
				<div>
					<p class="text-text-primary font-medium">Outcome Recorded</p>
					<p class="text-text-tertiary">When task completes, success/failure is recorded. Each linked memory gets salience adjusted.</p>
				</div>
			</div>
			<div class="flex gap-2">
				<span class="text-accent-primary font-mono">3.</span>
				<div>
					<p class="text-text-primary font-medium">Patterns Extracted</p>
					<p class="text-text-tertiary">After missions, decision types with high success rates are identified as reusable patterns.</p>
				</div>
			</div>
		</div>
	</div>
{/if}
