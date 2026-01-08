<script lang="ts">
	import type { Memory } from '$lib/types/memory';
	import Icon from './Icon.svelte';

	interface Props {
		learning: Memory;
		compact?: boolean;
		onClick?: (learning: Memory) => void;
	}

	let { learning, compact = false, onClick }: Props = $props();

	// Extract metadata with proper typing
	interface LearningMetadata {
		agent_id?: string;
		agent_name?: string;
		skill_id?: string;
		skill_name?: string;
		mission_id?: string;
		project_id?: string;
		project_name?: string;
		project_type?: string;
		team_id?: string;
		team_members?: string[];
		category?: string;
		tags?: string[];
		pattern_type?: 'success' | 'failure' | 'optimization' | 'discovery';
		confidence?: number;
		reinforcement_count?: number;
		reasoning?: string;
		decision_context?: string;
		feedback_sources?: string[];
		times_applied?: number;
		success_when_applied?: number;
	}

	const meta = $derived((learning.metadata || {}) as LearningMetadata);

	// Pattern type styling
	function getPatternIcon(type?: string): string {
		switch (type) {
			case 'success':
				return 'check';
			case 'failure':
				return 'alert-triangle';
			case 'optimization':
				return 'zap';
			case 'discovery':
				return 'lightbulb';
			default:
				return 'brain';
		}
	}

	function getPatternColor(type?: string): string {
		switch (type) {
			case 'success':
				return 'text-green-400 bg-green-500/10 border-green-500/30';
			case 'failure':
				return 'text-red-400 bg-red-500/10 border-red-500/30';
			case 'optimization':
				return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
			case 'discovery':
				return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
			default:
				return 'text-text-secondary bg-bg-secondary border-surface-border';
		}
	}

	function getPatternLabel(type?: string): string {
		switch (type) {
			case 'success':
				return 'Success';
			case 'failure':
				return 'Failure';
			case 'optimization':
				return 'Optimization';
			case 'discovery':
				return 'Discovery';
			default:
				return 'Learning';
		}
	}

	// Category styling
	function getCategoryColor(category?: string): string {
		switch (category) {
			case 'technical':
				return 'text-cyan-400 border-cyan-500/30';
			case 'process':
				return 'text-orange-400 border-orange-500/30';
			case 'collaboration':
				return 'text-pink-400 border-pink-500/30';
			case 'quality':
				return 'text-yellow-400 border-yellow-500/30';
			case 'performance':
				return 'text-emerald-400 border-emerald-500/30';
			case 'user_impact':
				return 'text-violet-400 border-violet-500/30';
			default:
				return 'text-text-tertiary border-surface-border';
		}
	}

	// Format confidence as percentage
	function formatConfidence(conf?: number): string {
		if (conf === undefined) return '';
		return `${Math.round(conf * 100)}%`;
	}

	// Format date relative
	function formatDate(dateStr?: string): string {
		if (!dateStr) return '';
		// Mind v5 stores timestamps in UTC without 'Z' suffix
		const utcDateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
		const date = new Date(utcDateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	// Get project type icon
	function getProjectTypeIcon(type?: string): string {
		switch (type) {
			case 'game':
				return 'gamepad-2';
			case 'marketing':
				return 'megaphone';
			case 'saas':
				return 'cloud';
			case 'tool':
				return 'wrench';
			case 'content':
				return 'file-text';
			default:
				return 'folder';
		}
	}
</script>

<button
	class="w-full text-left border transition-all hover:border-text-tertiary {getPatternColor(
		meta.pattern_type
	)}"
	class:p-4={!compact}
	class:p-3={compact}
	onclick={() => onClick?.(learning)}
>
	<!-- Header Row -->
	<div class="flex items-start gap-3">
		<!-- Pattern Icon -->
		<div
			class="shrink-0 w-8 h-8 rounded flex items-center justify-center {getPatternColor(
				meta.pattern_type
			)}"
		>
			<Icon name={getPatternIcon(meta.pattern_type)} size={16} />
		</div>

		<div class="flex-1 min-w-0">
			<!-- Content -->
			<p class="text-text-primary" class:text-sm={compact} class:line-clamp-2={compact}>
				{learning.content || 'No content'}
			</p>

			<!-- Context Row -->
			<div class="flex flex-wrap items-center gap-2 mt-2">
				<!-- Pattern Type Badge -->
				<span
					class="px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider border {getPatternColor(
						meta.pattern_type
					)}"
				>
					{getPatternLabel(meta.pattern_type)}
				</span>

				<!-- Category Badge -->
				{#if meta.category}
					<span
						class="px-1.5 py-0.5 text-[10px] font-mono border {getCategoryColor(meta.category)}"
					>
						{meta.category}
					</span>
				{/if}

				<!-- Skill Badge -->
				{#if meta.skill_id || meta.skill_name}
					<span
						class="px-1.5 py-0.5 text-[10px] font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10"
					>
						{meta.skill_name || meta.skill_id}
					</span>
				{/if}

				<!-- Confidence -->
				{#if meta.confidence !== undefined}
					<span class="text-[10px] font-mono text-text-tertiary flex items-center gap-1">
						<Icon name="bar-chart-2" size={10} />
						{formatConfidence(meta.confidence)}
					</span>
				{/if}
			</div>

			<!-- Extended Context (non-compact) -->
			{#if !compact}
				<div class="flex flex-wrap items-center gap-3 mt-3 text-xs">
					<!-- Project -->
					{#if meta.project_name || meta.project_id}
						<span class="flex items-center gap-1 text-text-tertiary">
							<Icon name={getProjectTypeIcon(meta.project_type)} size={12} />
							<span class="font-mono">{meta.project_name || meta.project_id}</span>
						</span>
					{/if}

					<!-- Agent -->
					{#if meta.agent_name || meta.agent_id}
						<span class="flex items-center gap-1 text-text-tertiary">
							<Icon name="bot" size={12} />
							<span class="font-mono">@{meta.agent_name || meta.agent_id}</span>
						</span>
					{/if}

					<!-- Team -->
					{#if meta.team_members && meta.team_members.length > 0}
						<span class="flex items-center gap-1 text-text-tertiary">
							<Icon name="users" size={12} />
							<span class="font-mono">{meta.team_members.length} skills</span>
						</span>
					{/if}

					<!-- Reinforcement -->
					{#if meta.reinforcement_count && meta.reinforcement_count > 1}
						<span class="flex items-center gap-1 text-text-tertiary">
							<Icon name="repeat" size={12} />
							<span class="font-mono">x{meta.reinforcement_count}</span>
						</span>
					{/if}

					<!-- Applied count -->
					{#if meta.times_applied}
						<span class="flex items-center gap-1 text-text-tertiary">
							<Icon name="play" size={12} />
							<span class="font-mono"
								>{meta.times_applied} uses{#if meta.success_when_applied}, {Math.round(
										(meta.success_when_applied / meta.times_applied) * 100
									)}% success{/if}</span
							>
						</span>
					{/if}

					<!-- Feedback sources -->
					{#if meta.feedback_sources && meta.feedback_sources.length > 0}
						<span class="flex items-center gap-1 text-emerald-400">
							<Icon name="message-circle" size={12} />
							<span class="font-mono">{meta.feedback_sources.length} feedback</span>
						</span>
					{/if}

					<!-- Timestamp (push to right) -->
					{#if learning.created_at}
						<span class="font-mono text-text-tertiary ml-auto">
							{formatDate(learning.created_at)}
						</span>
					{/if}
				</div>

				<!-- Reasoning (if available) -->
				{#if meta.reasoning}
					<p class="mt-2 text-sm text-text-secondary italic border-l-2 border-surface-border pl-2">
						"{meta.reasoning}"
					</p>
				{/if}

				<!-- Tags -->
				{#if meta.tags && meta.tags.length > 0}
					<div class="flex flex-wrap gap-1 mt-2">
						{#each meta.tags as tag}
							<span class="px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary bg-bg-primary">
								#{tag}
							</span>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Confidence Bar (side) -->
		{#if !compact && meta.confidence !== undefined}
			<div class="shrink-0 w-1 h-12 bg-bg-primary rounded overflow-hidden">
				<div
					class="w-full transition-all duration-300"
					class:bg-green-400={meta.confidence >= 0.8}
					class:bg-yellow-400={meta.confidence >= 0.5 && meta.confidence < 0.8}
					class:bg-red-400={meta.confidence < 0.5}
					style="height: {meta.confidence * 100}%"
				></div>
			</div>
		{/if}
	</div>
</button>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
