<script lang="ts">
	import type { Mission } from '$lib/services/mcp-client';
	import type { MissionSummary, LearningSummary } from '$lib/services/learning-reinforcement';
	import { generateMissionSummary, extractKeyInsights, getRecommendations } from '$lib/services/learning-reinforcement';

	interface Props {
		mission: Mission;
		startTime: Date;
		endTime: Date;
		onClose: () => void;
		onViewLearnings?: () => void;
	}

	let { mission, startTime, endTime, onClose, onViewLearnings }: Props = $props();

	let summary = $state<MissionSummary | null>(null);
	let insights = $state<string[]>([]);
	let recommendations = $state<string[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Load summary on mount
	$effect(() => {
		loadSummary();
	});

	async function loadSummary() {
		loading = true;
		error = null;

		try {
			summary = await generateMissionSummary(mission, startTime, endTime);
			insights = extractKeyInsights(summary);
			recommendations = getRecommendations(summary);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to generate summary';
			console.error('[PostMissionReview] Error:', e);
		} finally {
			loading = false;
		}
	}

	function getStatusIcon(success: boolean): string {
		return success ? '✓' : '✗';
	}

	function getStatusColor(success: boolean): string {
		return success ? 'text-accent-primary' : 'text-red-400';
	}

	function getLearningTypeIcon(type: LearningSummary['type']): string {
		switch (type) {
			case 'success': return '✓';
			case 'failure': return '!';
			case 'optimization': return '↑';
			default: return '•';
		}
	}

	function getLearningTypeColor(type: LearningSummary['type']): string {
		switch (type) {
			case 'success': return 'border-accent-primary/30 bg-accent-primary/5';
			case 'failure': return 'border-red-500/30 bg-red-500/5';
			case 'optimization': return 'border-blue-500/30 bg-blue-500/5';
			default: return 'border-surface-border bg-surface/50';
		}
	}

	function formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds}s`;
	}
</script>

<!-- Post-Mission Review Modal -->
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={onClose} role="button" tabindex="-1">
	<div
		class="bg-bg-secondary border border-surface-border w-full max-w-lg max-h-[85vh] flex flex-col"
		onclick={(e) => e.stopPropagation()}
		role="dialog"
		aria-labelledby="review-title"
	>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-surface-border">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-full flex items-center justify-center {summary?.successRate && summary.successRate >= 0.7 ? 'bg-accent-primary/20' : 'bg-yellow-500/20'}">
					{#if summary?.successRate && summary.successRate >= 0.7}
						<span class="text-accent-primary">✓</span>
					{:else}
						<span class="text-yellow-400">!</span>
					{/if}
				</div>
				<div>
					<h2 id="review-title" class="font-serif text-lg text-text-primary">Mission Review</h2>
					<p class="text-xs text-text-tertiary">{mission.name}</p>
				</div>
			</div>
			<button onclick={onClose} class="text-text-tertiary hover:text-text-primary">
				X
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4 space-y-4">
			{#if loading}
				<div class="text-center py-8">
					<div class="animate-pulse text-text-tertiary">Analyzing mission results...</div>
				</div>
			{:else if error}
				<div class="text-center py-8">
					<div class="text-red-400 mb-2">Failed to generate review</div>
					<p class="text-text-tertiary text-sm">{error}</p>
				</div>
			{:else if summary}
				<!-- Summary Stats -->
				<div class="grid grid-cols-3 gap-3">
					<div class="p-3 border border-surface-border bg-surface/50 text-center">
						<div class="text-2xl font-mono text-text-primary">{summary.successfulTasks}/{summary.totalTasks}</div>
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Tasks Done</div>
					</div>
					<div class="p-3 border border-surface-border bg-surface/50 text-center">
						<div class="text-2xl font-mono {summary.successRate >= 0.7 ? 'text-accent-primary' : summary.successRate >= 0.5 ? 'text-yellow-400' : 'text-red-400'}">
							{Math.round(summary.successRate * 100)}%
						</div>
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Success Rate</div>
					</div>
					<div class="p-3 border border-surface-border bg-surface/50 text-center">
						<div class="text-2xl font-mono text-text-primary">{formatDuration(summary.duration)}</div>
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Duration</div>
					</div>
				</div>

				<!-- Key Insights -->
				{#if insights.length > 0}
					<div class="space-y-2">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Key Insights</div>
						<div class="space-y-1">
							{#each insights as insight}
								<div class="flex items-center gap-2 text-sm text-text-secondary">
									<span class="text-accent-secondary">•</span>
									<span>{insight}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Skills Used -->
				{#if summary.skillsUsed.length > 0}
					<div class="space-y-2">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Skills Used</div>
						<div class="flex flex-wrap gap-1.5">
							{#each summary.skillsUsed as skill}
								<span class="px-2 py-0.5 text-xs font-mono bg-surface border border-surface-border text-text-secondary">
									{skill}
								</span>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Learnings -->
				{#if summary.learnings.length > 0}
					<div class="space-y-2">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
							What Mind Learned
						</div>
						<div class="space-y-1.5">
							{#each summary.learnings as learning}
								<div class="p-2 border {getLearningTypeColor(learning.type)}">
									<div class="flex items-start gap-2">
										<span class="text-sm {learning.type === 'success' ? 'text-accent-primary' : learning.type === 'failure' ? 'text-red-400' : 'text-blue-400'}">
											{getLearningTypeIcon(learning.type)}
										</span>
										<div class="flex-1 min-w-0">
											<p class="text-xs text-text-primary line-clamp-2">{learning.content}</p>
											{#if learning.skillId}
												<span class="text-[10px] font-mono text-text-tertiary mt-1 block">
													from {learning.skillId}
												</span>
											{/if}
										</div>
										<span class="text-[10px] font-mono text-text-tertiary">
											{Math.round(learning.confidence * 100)}%
										</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="p-3 border border-surface-border bg-surface/50 text-center">
						<p class="text-xs text-text-tertiary">No new learnings from this mission</p>
					</div>
				{/if}

				<!-- Patterns Updated -->
				{#if summary.patterns.length > 0}
					<div class="space-y-2">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
							Pattern Updates
						</div>
						<div class="space-y-1.5">
							{#each summary.patterns as pattern}
								<div class="flex items-center justify-between p-2 border border-surface-border bg-surface/50">
									<span class="text-xs text-text-secondary truncate flex-1 mr-2">
										{pattern.content.slice(0, 50)}...
									</span>
									<span class="text-xs font-mono {pattern.confidenceChange > 0 ? 'text-accent-primary' : pattern.confidenceChange < 0 ? 'text-red-400' : 'text-text-tertiary'}">
										{pattern.confidenceChange > 0 ? '+' : ''}{Math.round(pattern.confidenceChange * 100)}%
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recommendations -->
				{#if recommendations.length > 0}
					<div class="space-y-2">
						<div class="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Recommendations</div>
						<div class="p-3 border border-blue-500/30 bg-blue-500/5 space-y-1">
							{#each recommendations as rec}
								<div class="flex items-start gap-2 text-xs text-blue-400">
									<span>→</span>
									<span>{rec}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Footer -->
		<div class="p-4 border-t border-surface-border flex justify-between items-center">
			<div class="text-xs text-text-tertiary">
				{#if summary}
					{summary.learnings.length} learning{summary.learnings.length !== 1 ? 's' : ''} recorded
				{/if}
			</div>
			<div class="flex gap-2">
				{#if onViewLearnings && summary && summary.learnings.length > 0}
					<button
						onclick={onViewLearnings}
						class="px-4 py-1.5 text-sm font-mono text-accent-secondary border border-accent-secondary/50 hover:bg-accent-secondary/10 transition-all"
					>
						View All Learnings
					</button>
				{/if}
				<button
					onclick={onClose}
					class="px-4 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
				>
					Done
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
