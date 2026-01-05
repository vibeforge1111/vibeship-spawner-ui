<script lang="ts">
	import { complianceTracker } from '$lib/spawner-live/enforcement';
	import { severityColors, deviationTypeLabels } from '$lib/spawner-live/types/compliance';

	const { compliance, summary, score, status, deviations } = complianceTracker;

	let expanded = $state(true);

	function getStatusColor(status: string): string {
		switch (status) {
			case 'following':
				return '#22c55e';
			case 'completed':
				return '#22c55e';
			case 'deviated':
				return '#f59e0b';
			case 'failed':
				return '#ef4444';
			default:
				return '#6b7280';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'not_started':
				return 'Not Started';
			case 'following':
				return 'Following Pipeline';
			case 'deviated':
				return 'Deviated';
			case 'completed':
				return 'Completed';
			case 'failed':
				return 'Failed';
			default:
				return status;
		}
	}

	function acknowledgeDeviation(id: string) {
		complianceTracker.acknowledgeDeviation(id);
	}
</script>

<div class="compliance-panel" class:collapsed={!expanded}>
	<button class="panel-header" onclick={() => (expanded = !expanded)}>
		<div class="header-left">
			<span class="status-dot" style="background: {getStatusColor($status)}"></span>
			<span class="panel-title">Pipeline Compliance</span>
		</div>
		<div class="header-right">
			<span class="score" class:healthy={$score >= 80} class:warning={$score >= 50 && $score < 80} class:critical={$score < 50}>
				{$score}%
			</span>
			<svg
				class="chevron"
				class:rotated={!expanded}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<polyline points="6 9 12 15 18 9" />
			</svg>
		</div>
	</button>

	{#if expanded}
		<div class="panel-content">
			<!-- Status Bar -->
			<div class="status-bar">
				<span class="status-label" style="color: {getStatusColor($status)}">
					{getStatusLabel($status)}
				</span>
			</div>

			<!-- Progress -->
			<div class="progress-section">
				<div class="progress-label">
					<span>Progress</span>
					<span>{$compliance.completedSteps.length} / {$compliance.expectedSteps.length} steps</span>
				</div>
				<div class="progress-bar">
					<div
						class="progress-fill"
						style="width: {($compliance.expectedSteps.length > 0
							? ($compliance.completedSteps.length / $compliance.expectedSteps.length) * 100
							: 0)}%"
					></div>
				</div>
			</div>

			<!-- Steps -->
			{#if $compliance.expectedSteps.length > 0}
				<div class="steps-section">
					<div class="section-title">Steps</div>
					<div class="steps-list">
						{#each $compliance.expectedSteps as stepId, index}
							{@const isCompleted = $compliance.completedSteps.includes(stepId)}
							{@const isCurrent = $compliance.currentStep === stepId}
							<div class="step" class:completed={isCompleted} class:current={isCurrent}>
								<span class="step-indicator">
									{#if isCompleted}
										<svg viewBox="0 0 24 24" fill="currentColor">
											<path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
										</svg>
									{:else if isCurrent}
										<span class="pulse-dot"></span>
									{:else}
										<span class="step-number">{index + 1}</span>
									{/if}
								</span>
								<span class="step-name">{stepId}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Deviations -->
			{#if $deviations.length > 0}
				<div class="deviations-section">
					<div class="section-title">
						Deviations
						<span class="deviation-count">{$deviations.length}</span>
					</div>
					<div class="deviations-list">
						{#each $deviations as deviation}
							<div
								class="deviation"
								class:acknowledged={deviation.acknowledged}
								style="border-left-color: {severityColors[deviation.severity]}"
							>
								<div class="deviation-header">
									<span class="deviation-type" style="color: {severityColors[deviation.severity]}">
										{deviationTypeLabels[deviation.type]}
									</span>
									{#if !deviation.acknowledged}
										<button class="ack-button" onclick={() => acknowledgeDeviation(deviation.id)}>
											Dismiss
										</button>
									{/if}
								</div>
								<div class="deviation-message">{deviation.message}</div>
								<div class="deviation-time">
									{new Date(deviation.timestamp).toLocaleTimeString()}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Summary Stats -->
			<div class="summary-section">
				<div class="stat">
					<span class="stat-value" style="color: #22c55e">{$summary.completedSteps}</span>
					<span class="stat-label">Completed</span>
				</div>
				<div class="stat">
					<span class="stat-value" style="color: #f59e0b">{$summary.skippedSteps}</span>
					<span class="stat-label">Skipped</span>
				</div>
				<div class="stat">
					<span class="stat-value" style="color: #ef4444">{$summary.deviationCount}</span>
					<span class="stat-label">Deviations</span>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.compliance-panel {
		background: var(--bg-secondary, #1e1e2e);
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		overflow: hidden;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 12px 16px;
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--text-primary, #cdd6f4);
	}

	.panel-header:hover {
		background: var(--bg-hover, #313244);
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.panel-title {
		font-size: 13px;
		font-weight: 600;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.score {
		font-size: 14px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 4px;
	}

	.score.healthy {
		color: #22c55e;
		background: #22c55e20;
	}

	.score.warning {
		color: #f59e0b;
		background: #f59e0b20;
	}

	.score.critical {
		color: #ef4444;
		background: #ef444420;
	}

	.chevron {
		width: 16px;
		height: 16px;
		color: var(--text-secondary, #a6adc8);
		transition: transform 0.2s ease;
	}

	.chevron.rotated {
		transform: rotate(-90deg);
	}

	.panel-content {
		padding: 0 16px 16px;
	}

	.status-bar {
		padding: 8px 12px;
		background: var(--bg-tertiary, #313244);
		border-radius: 6px;
		margin-bottom: 12px;
	}

	.status-label {
		font-size: 12px;
		font-weight: 600;
	}

	.progress-section {
		margin-bottom: 16px;
	}

	.progress-label {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		margin-bottom: 4px;
	}

	.progress-bar {
		height: 6px;
		background: var(--bg-tertiary, #313244);
		border-radius: 3px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #3b82f6, #22c55e);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.section-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #a6adc8);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 8px;
	}

	.steps-section {
		margin-bottom: 16px;
	}

	.steps-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.step {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 4px;
		font-size: 12px;
		color: var(--text-secondary, #a6adc8);
	}

	.step.completed {
		color: #22c55e;
	}

	.step.current {
		background: #3b82f620;
		color: #3b82f6;
	}

	.step-indicator {
		width: 18px;
		height: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.step-indicator svg {
		width: 14px;
		height: 14px;
	}

	.step-number {
		font-size: 10px;
		font-weight: 600;
	}

	.pulse-dot {
		width: 8px;
		height: 8px;
		background: #3b82f6;
		border-radius: 50%;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(1.2);
		}
	}

	.step-name {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.deviations-section {
		margin-bottom: 16px;
	}

	.deviation-count {
		background: #ef444430;
		color: #ef4444;
		padding: 1px 6px;
		border-radius: 10px;
		font-size: 10px;
	}

	.deviations-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.deviation {
		padding: 8px 12px;
		background: var(--bg-tertiary, #313244);
		border-radius: 4px;
		border-left: 3px solid;
	}

	.deviation.acknowledged {
		opacity: 0.5;
	}

	.deviation-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 4px;
	}

	.deviation-type {
		font-size: 11px;
		font-weight: 600;
	}

	.ack-button {
		font-size: 10px;
		padding: 2px 6px;
		background: transparent;
		border: 1px solid var(--border-color, #313244);
		border-radius: 4px;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
	}

	.ack-button:hover {
		background: var(--bg-hover, #45475a);
	}

	.deviation-message {
		font-size: 12px;
		color: var(--text-primary, #cdd6f4);
		line-height: 1.4;
	}

	.deviation-time {
		font-size: 10px;
		color: var(--text-muted, #6c7086);
		margin-top: 4px;
	}

	.summary-section {
		display: flex;
		justify-content: space-around;
		padding: 12px;
		background: var(--bg-tertiary, #313244);
		border-radius: 6px;
	}

	.stat {
		text-align: center;
	}

	.stat-value {
		display: block;
		font-size: 20px;
		font-weight: 700;
	}

	.stat-label {
		font-size: 10px;
		color: var(--text-secondary, #a6adc8);
		text-transform: uppercase;
	}
</style>
