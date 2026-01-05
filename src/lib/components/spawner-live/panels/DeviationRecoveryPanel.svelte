<script lang="ts">
	import { onMount } from 'svelte';
	import {
		complianceTracker,
		pipelineRunner,
		soundManager
	} from '$lib/spawner-live';
	import type { Deviation, DeviationSeverity, ComplianceState } from '$lib/spawner-live/types/compliance';
	import type { ExecutionState } from '$lib/spawner-live/execution';

	interface Props {
		onClose?: () => void;
		onRecoveryAction?: (action: RecoveryAction, deviationId?: string) => void;
	}

	type RecoveryAction = 'continue' | 'retry' | 'skip' | 'cancel' | 'acknowledge' | 'acknowledge_all';

	let { onClose, onRecoveryAction }: Props = $props();

	// Local state from stores
	let complianceState = $state<ComplianceState | null>(null);
	let executionState = $state<ExecutionState | null>(null);
	let selectedDeviation = $state<Deviation | null>(null);

	// Computed values
	let unacknowledgedDeviations = $derived(
		complianceState?.deviations.filter(d => !d.acknowledged) || []
	);
	let acknowledgedDeviations = $derived(
		complianceState?.deviations.filter(d => d.acknowledged) || []
	);
	let hasUnacknowledged = $derived(unacknowledgedDeviations.length > 0);
	let isExecuting = $derived(
		executionState?.status === 'running' || executionState?.status === 'paused'
	);
	let isPaused = $derived(executionState?.status === 'paused');

	onMount(() => {
		const unsubCompliance = complianceTracker.compliance.subscribe((state) => {
			complianceState = state;
		});

		const unsubExecution = pipelineRunner.state.subscribe((state) => {
			executionState = state;
		});

		return () => {
			unsubCompliance();
			unsubExecution();
		};
	});

	// Severity styling
	function getSeverityClass(severity: DeviationSeverity): string {
		switch (severity) {
			case 'error':
				return 'severity-error';
			case 'warning':
				return 'severity-warning';
			case 'info':
			default:
				return 'severity-info';
		}
	}

	function getSeverityIcon(severity: DeviationSeverity): string {
		switch (severity) {
			case 'error':
				return '⛔';
			case 'warning':
				return '⚠️';
			case 'info':
			default:
				return 'ℹ️';
		}
	}

	function getDeviationTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			unexpected_step: 'Unexpected Step',
			skipped_step: 'Skipped Step',
			out_of_order: 'Out of Order',
			unknown_action: 'Unknown Action',
			critical_skip: 'Critical Skip'
		};
		return labels[type] || type;
	}

	// Format relative time
	function formatRelativeTime(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return date.toLocaleDateString();
	}

	// Actions
	function handleContinue() {
		soundManager.play('handoff');
		onRecoveryAction?.('continue');

		// Resume if paused
		if (isPaused) {
			pipelineRunner.resume();
		}
	}

	function handleRetry() {
		soundManager.play('progress');
		onRecoveryAction?.('retry');
		// Note: actual retry logic would need to be implemented in pipeline runner
	}

	function handleSkip() {
		soundManager.play('exit');
		onRecoveryAction?.('skip');
		// Note: actual skip logic would need to be implemented in pipeline runner
	}

	function handleCancel() {
		soundManager.play('error');
		pipelineRunner.cancel();
		onRecoveryAction?.('cancel');
	}

	function handleAcknowledge(deviationId: string) {
		complianceTracker.acknowledgeDeviation(deviationId);
		onRecoveryAction?.('acknowledge', deviationId);
	}

	function handleAcknowledgeAll() {
		complianceTracker.acknowledgeAll();
		onRecoveryAction?.('acknowledge_all');
	}

	function selectDeviation(deviation: Deviation) {
		selectedDeviation = selectedDeviation?.id === deviation.id ? null : deviation;
	}

	// Get score color
	function getScoreColor(score: number): string {
		if (score >= 80) return 'var(--status-success, #22c55e)';
		if (score >= 50) return 'var(--status-warning, #f59e0b)';
		return 'var(--status-error, #ef4444)';
	}
</script>

<div class="deviation-panel">
	<div class="panel-header">
		<h3>Deviation Recovery</h3>
		{#if onClose}
			<button class="close-btn" onclick={onClose} aria-label="Close panel">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Status Overview -->
	<div class="status-overview">
		<div class="score-indicator">
			<div
				class="score-ring"
				style="--score-color: {getScoreColor(complianceState?.score || 100)}"
			>
				<span class="score-value">{complianceState?.score || 100}</span>
			</div>
			<span class="score-label">Compliance Score</span>
		</div>

		<div class="status-details">
			<div class="status-row">
				<span class="status-label">Status</span>
				<span class="status-value {complianceState?.status || 'not_started'}">
					{complianceState?.status?.replace('_', ' ') || 'Not Started'}
				</span>
			</div>
			<div class="status-row">
				<span class="status-label">Deviations</span>
				<span class="status-value">{complianceState?.deviations.length || 0}</span>
			</div>
			<div class="status-row">
				<span class="status-label">Progress</span>
				<span class="status-value">
					{complianceState?.completedSteps.length || 0}/{complianceState?.expectedSteps.length || 0}
				</span>
			</div>
		</div>
	</div>

	<!-- Recovery Actions -->
	{#if isExecuting || hasUnacknowledged}
		<div class="recovery-actions">
			<h4>Recovery Options</h4>
			<div class="action-buttons">
				<button
					class="action-btn continue"
					onclick={handleContinue}
					disabled={!isExecuting && !hasUnacknowledged}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<span>{isPaused ? 'Resume' : 'Continue'}</span>
				</button>

				<button
					class="action-btn retry"
					onclick={handleRetry}
					disabled={!executionState?.currentNodeId}
					title="Retry current node"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
					</svg>
					<span>Retry</span>
				</button>

				<button
					class="action-btn skip"
					onclick={handleSkip}
					disabled={!executionState?.currentNodeId}
					title="Skip current node"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
					</svg>
					<span>Skip</span>
				</button>

				<button
					class="action-btn cancel"
					onclick={handleCancel}
					disabled={!isExecuting}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
					<span>Cancel</span>
				</button>
			</div>
		</div>
	{/if}

	<!-- Deviations List -->
	<div class="deviations-section">
		<div class="section-header">
			<h4>Deviations ({complianceState?.deviations.length || 0})</h4>
			{#if hasUnacknowledged}
				<button class="text-btn" onclick={handleAcknowledgeAll}>
					Acknowledge All
				</button>
			{/if}
		</div>

		{#if complianceState?.deviations.length === 0}
			<div class="empty-state">
				<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
				</svg>
				<p>No deviations detected</p>
				<span>Pipeline is following the expected path</span>
			</div>
		{:else}
			<div class="deviations-list">
				<!-- Unacknowledged first -->
				{#each unacknowledgedDeviations as deviation (deviation.id)}
					<div
						class="deviation-item {getSeverityClass(deviation.severity)}"
						class:selected={selectedDeviation?.id === deviation.id}
						onclick={() => selectDeviation(deviation)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && selectDeviation(deviation)}
					>
						<div class="deviation-header">
							<span class="severity-icon">{getSeverityIcon(deviation.severity)}</span>
							<span class="deviation-type">{getDeviationTypeLabel(deviation.type)}</span>
							<span class="deviation-time">{formatRelativeTime(deviation.timestamp)}</span>
						</div>
						<p class="deviation-message">{deviation.message}</p>
						{#if deviation.nodeId}
							<span class="deviation-node">Node: {deviation.nodeId}</span>
						{/if}

						{#if selectedDeviation?.id === deviation.id}
							<div class="deviation-actions">
								<button
									class="small-btn"
									onclick={(e) => { e.stopPropagation(); handleAcknowledge(deviation.id); }}
								>
									Acknowledge
								</button>
							</div>
						{/if}
					</div>
				{/each}

				<!-- Acknowledged (collapsed) -->
				{#if acknowledgedDeviations.length > 0}
					<details class="acknowledged-section">
						<summary>
							{acknowledgedDeviations.length} acknowledged deviation{acknowledgedDeviations.length > 1 ? 's' : ''}
						</summary>
						{#each acknowledgedDeviations as deviation (deviation.id)}
							<div class="deviation-item acknowledged {getSeverityClass(deviation.severity)}">
								<div class="deviation-header">
									<span class="severity-icon">{getSeverityIcon(deviation.severity)}</span>
									<span class="deviation-type">{getDeviationTypeLabel(deviation.type)}</span>
									<span class="acknowledged-badge">✓</span>
								</div>
								<p class="deviation-message">{deviation.message}</p>
							</div>
						{/each}
					</details>
				{/if}
			</div>
		{/if}
	</div>
</div>

<style>
	.deviation-panel {
		background: var(--bg-secondary, #1a1a24);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 8px;
		width: 380px;
		max-height: 600px;
		display: flex;
		flex-direction: column;
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

	/* Status Overview */
	.status-overview {
		display: flex;
		gap: 16px;
		padding: 16px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.score-indicator {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}

	.score-ring {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		border: 3px solid var(--score-color, #22c55e);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface, #252530);
	}

	.score-value {
		font-size: 18px;
		font-weight: 700;
		color: var(--text-primary, #fff);
	}

	.score-label {
		font-size: 9px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-tertiary, #666);
	}

	.status-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.status-label {
		color: var(--text-tertiary, #666);
		font-size: 11px;
	}

	.status-value {
		color: var(--text-primary, #fff);
		font-size: 11px;
		font-weight: 500;
		text-transform: capitalize;
	}

	.status-value.following {
		color: var(--status-success, #22c55e);
	}

	.status-value.deviated {
		color: var(--status-warning, #f59e0b);
	}

	.status-value.failed {
		color: var(--status-error, #ef4444);
	}

	/* Recovery Actions */
	.recovery-actions {
		padding: 16px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.recovery-actions h4 {
		margin: 0 0 12px 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent-primary, #22c55e);
	}

	.action-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 8px 12px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		border-color: var(--accent-primary, #22c55e);
	}

	.action-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.action-btn.continue:hover:not(:disabled) {
		border-color: var(--status-success, #22c55e);
		background: rgba(34, 197, 94, 0.1);
	}

	.action-btn.retry:hover:not(:disabled) {
		border-color: var(--accent-secondary, #3b82f6);
		background: rgba(59, 130, 246, 0.1);
	}

	.action-btn.skip:hover:not(:disabled) {
		border-color: var(--status-warning, #f59e0b);
		background: rgba(245, 158, 11, 0.1);
	}

	.action-btn.cancel:hover:not(:disabled) {
		border-color: var(--status-error, #ef4444);
		background: rgba(239, 68, 68, 0.1);
	}

	/* Deviations Section */
	.deviations-section {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 12px 16px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.section-header h4 {
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--text-secondary, #888);
	}

	.text-btn {
		background: none;
		border: none;
		color: var(--accent-primary, #22c55e);
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		cursor: pointer;
		padding: 4px 8px;
	}

	.text-btn:hover {
		text-decoration: underline;
	}

	.deviations-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 32px;
		color: var(--text-tertiary, #666);
		text-align: center;
	}

	.empty-state svg {
		color: var(--status-success, #22c55e);
		opacity: 0.5;
		margin-bottom: 12px;
	}

	.empty-state p {
		margin: 0;
		color: var(--text-secondary, #888);
		font-size: 12px;
	}

	.empty-state span {
		font-size: 10px;
		margin-top: 4px;
	}

	/* Deviation Item */
	.deviation-item {
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 6px;
		padding: 10px 12px;
		margin-bottom: 8px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.deviation-item:hover {
		border-color: var(--text-tertiary, #666);
	}

	.deviation-item.selected {
		border-color: var(--accent-primary, #22c55e);
	}

	.deviation-item.acknowledged {
		opacity: 0.6;
	}

	.deviation-item.severity-error {
		border-left: 3px solid var(--status-error, #ef4444);
	}

	.deviation-item.severity-warning {
		border-left: 3px solid var(--status-warning, #f59e0b);
	}

	.deviation-item.severity-info {
		border-left: 3px solid var(--accent-secondary, #3b82f6);
	}

	.deviation-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}

	.severity-icon {
		font-size: 12px;
	}

	.deviation-type {
		font-weight: 600;
		color: var(--text-primary, #fff);
		font-size: 11px;
	}

	.deviation-time {
		margin-left: auto;
		font-size: 10px;
		color: var(--text-tertiary, #666);
	}

	.deviation-message {
		margin: 0;
		color: var(--text-secondary, #888);
		font-size: 11px;
		line-height: 1.4;
	}

	.deviation-node {
		display: inline-block;
		margin-top: 6px;
		padding: 2px 6px;
		background: var(--bg-primary, #0f0f14);
		border-radius: 3px;
		font-size: 10px;
		color: var(--text-tertiary, #666);
	}

	.deviation-actions {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--surface-border, #2a2a3a);
	}

	.small-btn {
		padding: 4px 10px;
		background: var(--accent-primary, #22c55e);
		border: none;
		border-radius: 3px;
		color: #000;
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.15s;
	}

	.small-btn:hover {
		opacity: 0.9;
	}

	.acknowledged-badge {
		margin-left: auto;
		color: var(--status-success, #22c55e);
		font-size: 10px;
	}

	/* Acknowledged Section */
	.acknowledged-section {
		margin-top: 8px;
	}

	.acknowledged-section summary {
		padding: 8px 12px;
		background: var(--surface, #252530);
		border-radius: 4px;
		color: var(--text-tertiary, #666);
		font-size: 11px;
		cursor: pointer;
		list-style: none;
	}

	.acknowledged-section summary::-webkit-details-marker {
		display: none;
	}

	.acknowledged-section summary::before {
		content: '▶ ';
		font-size: 10px;
	}

	.acknowledged-section[open] summary::before {
		content: '▼ ';
	}

	.acknowledged-section .deviation-item {
		margin-top: 8px;
	}

	/* Scrollbar */
	.deviations-list::-webkit-scrollbar {
		width: 6px;
	}

	.deviations-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.deviations-list::-webkit-scrollbar-thumb {
		background: var(--surface-border, #2a2a3a);
		border-radius: 3px;
	}

	.deviations-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-tertiary, #666);
	}
</style>
