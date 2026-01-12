<script lang="ts">
	import {
		queueItems,
		queueLength,
		isQueueProcessing,
		currentQueueItem,
		removeFromQueue,
		clearCompleted,
		retryItem,
		skipCurrentItem,
		getQueueStats,
		type QueueItem
	} from '$lib/services/contentforge-queue';
	import Spinner from '$lib/components/ui/Spinner.svelte';

	// Props
	export let onSelectItem: (item: QueueItem) => void = () => {};
	export let selectedItemId: string | null = null;
	export let compact: boolean = false;

	// Local state
	let showCompleted = true;

	$: stats = getQueueStats();
	$: displayItems = showCompleted
		? $queueItems
		: $queueItems.filter(i => i.status === 'queued' || i.status === 'processing');

	function getStatusIcon(status: QueueItem['status']): string {
		switch (status) {
			case 'queued': return '...';
			case 'processing': return '';
			case 'complete': return '';
			case 'error': return '';
			default: return '';
		}
	}

	function getStatusColor(status: QueueItem['status']): string {
		switch (status) {
			case 'queued': return 'text-yellow-400';
			case 'processing': return 'text-teal-400';
			case 'complete': return 'text-green-400';
			case 'error': return 'text-red-400';
			default: return 'text-gray-400';
		}
	}

	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function handleRemove(e: MouseEvent, itemId: string) {
		e.stopPropagation();
		removeFromQueue(itemId);
	}

	function handleRetry(e: MouseEvent, itemId: string) {
		e.stopPropagation();
		retryItem(itemId);
	}

	function handleSkip(e: MouseEvent) {
		e.stopPropagation();
		skipCurrentItem();
	}
</script>

<div class="content-queue {compact ? 'compact' : ''}">
	<!-- Header -->
	<div class="queue-header">
		<div class="queue-title">
			<span class="title-text">Queue</span>
			{#if $queueLength > 0}
				<span class="queue-count">{$queueLength}</span>
			{/if}
			{#if $isQueueProcessing}
				<Spinner size="sm" />
			{/if}
		</div>
		<div class="queue-actions">
			<button
				class="action-btn"
				on:click={() => showCompleted = !showCompleted}
				title={showCompleted ? 'Hide completed' : 'Show completed'}
			>
				{showCompleted ? 'Hide done' : 'Show all'}
			</button>
			{#if stats.completed > 0 || stats.errors > 0}
				<button
					class="action-btn clear"
					on:click={clearCompleted}
					title="Clear completed items"
				>
					Clear
				</button>
			{/if}
		</div>
	</div>

	<!-- Stats bar -->
	{#if stats.total > 0 && !compact}
		<div class="queue-stats">
			<span class="stat">
				<span class="stat-value">{stats.completed}</span> done
			</span>
			{#if stats.errors > 0}
				<span class="stat error">
					<span class="stat-value">{stats.errors}</span> failed
				</span>
			{/if}
			{#if stats.avgScore > 0}
				<span class="stat score">
					avg: <span class="stat-value">{stats.avgScore.toFixed(0)}</span>
				</span>
			{/if}
		</div>
	{/if}

	<!-- Queue list -->
	<div class="queue-list">
		{#if displayItems.length === 0}
			<div class="empty-state">
				<p>No items in queue</p>
				<p class="hint">Add content to analyze</p>
			</div>
		{:else}
			{#each displayItems as item (item.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="queue-item {item.status} {selectedItemId === item.id ? 'selected' : ''}"
					on:click={() => onSelectItem(item)}
					role="button"
					tabindex="0"
				>
					<div class="item-status {getStatusColor(item.status)}">
						{#if item.status === 'processing'}
							<Spinner size="sm" />
						{:else}
							{getStatusIcon(item.status)}
						{/if}
					</div>
					<div class="item-content">
						<div class="item-label">{item.label}</div>
						<div class="item-meta">
							{#if item.status === 'queued'}
								#{item.position} in queue
							{:else if item.status === 'processing'}
								{#if item.workerAcknowledged}
									<span class="worker-active">{item.workerProgress || 'Processing...'}</span>
								{:else}
									<span class="worker-waiting">Waiting for worker...</span>
								{/if}
							{:else if item.status === 'complete' && item.result?.synthesis?.viralityScore}
								Score: {item.result.synthesis.viralityScore}
							{:else if item.status === 'error'}
								{item.error?.slice(0, 30)}...
							{/if}
						</div>
					</div>
					<div class="item-actions">
						{#if item.status === 'queued'}
							<button
								class="item-action remove"
								on:click={(e) => handleRemove(e, item.id)}
								title="Remove from queue"
							>
								x
							</button>
						{:else if item.status === 'processing'}
							<button
								class="item-action skip"
								on:click={(e) => handleSkip(e)}
								title="Skip this item"
							>
								Skip
							</button>
						{:else if item.status === 'error'}
							<button
								class="item-action retry"
								on:click={(e) => handleRetry(e, item.id)}
								title="Retry"
							>
								Retry
							</button>
						{:else if item.status === 'complete'}
							<span class="item-time">{formatTime(item.completedAt || item.addedAt)}</span>
						{/if}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.content-queue {
		display: flex;
		flex-direction: column;
		background: var(--surface-bg, #0d1117);
		border: 1px solid var(--surface-border, #30363d);
		height: 100%;
		min-height: 200px;
	}

	.content-queue.compact {
		min-height: 150px;
	}

	.queue-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--surface-border, #30363d);
		background: var(--surface-elevated, #161b22);
	}

	.queue-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
		font-size: 0.875rem;
		color: var(--text-primary, #e6edf3);
	}

	.title-text {
		font-family: monospace;
	}

	.queue-count {
		background: var(--accent-primary, #00d9ff);
		color: #000;
		font-size: 0.75rem;
		padding: 0.125rem 0.5rem;
		font-weight: 700;
	}

	.queue-actions {
		display: flex;
		gap: 0.5rem;
	}

	.action-btn {
		background: transparent;
		border: 1px solid var(--surface-border, #30363d);
		color: var(--text-secondary, #8b949e);
		font-size: 0.75rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-family: monospace;
		transition: all 0.15s;
	}

	.action-btn:hover {
		background: var(--surface-elevated, #161b22);
		color: var(--text-primary, #e6edf3);
	}

	.action-btn.clear:hover {
		border-color: var(--accent-primary, #00d9ff);
		color: var(--accent-primary, #00d9ff);
	}

	.queue-stats {
		display: flex;
		gap: 1rem;
		padding: 0.5rem 1rem;
		font-size: 0.75rem;
		color: var(--text-secondary, #8b949e);
		border-bottom: 1px solid var(--surface-border, #30363d);
		font-family: monospace;
	}

	.stat-value {
		color: var(--text-primary, #e6edf3);
		font-weight: 600;
	}

	.stat.error .stat-value {
		color: #f85149;
	}

	.stat.score .stat-value {
		color: var(--accent-primary, #00d9ff);
	}

	.queue-list {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-secondary, #8b949e);
		font-size: 0.875rem;
		padding: 2rem;
	}

	.empty-state .hint {
		font-size: 0.75rem;
		opacity: 0.7;
		margin-top: 0.25rem;
	}

	.queue-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.75rem;
		margin-bottom: 0.25rem;
		background: var(--surface-elevated, #161b22);
		border: 1px solid transparent;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
	}

	.queue-item:hover {
		border-color: var(--surface-border, #30363d);
	}

	.queue-item.selected {
		border-color: var(--accent-primary, #00d9ff);
		background: rgba(0, 217, 255, 0.05);
	}

	.queue-item.processing {
		border-color: var(--accent-primary, #00d9ff);
	}

	.queue-item.complete {
		opacity: 0.8;
	}

	.queue-item.error {
		border-color: rgba(248, 81, 73, 0.3);
	}

	.item-status {
		flex-shrink: 0;
		width: 1.5rem;
		text-align: center;
		font-size: 0.875rem;
	}

	.item-content {
		flex: 1;
		min-width: 0;
	}

	.item-label {
		font-size: 0.875rem;
		color: var(--text-primary, #e6edf3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: monospace;
	}

	.item-meta {
		font-size: 0.75rem;
		color: var(--text-secondary, #8b949e);
		margin-top: 0.125rem;
	}

	.item-actions {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.item-action {
		background: transparent;
		border: none;
		color: var(--text-secondary, #8b949e);
		cursor: pointer;
		padding: 0.25rem;
		font-size: 0.875rem;
		opacity: 0.6;
		transition: opacity 0.15s;
	}

	.item-action:hover {
		opacity: 1;
	}

	.item-action.remove:hover {
		color: #f85149;
	}

	.item-action.retry:hover {
		color: var(--accent-primary, #00d9ff);
	}

	.item-action.skip {
		color: #f0ad4e;
	}

	.item-action.skip:hover {
		color: #ec971f;
	}

	.item-time {
		font-size: 0.7rem;
		color: var(--text-secondary, #8b949e);
		font-family: monospace;
	}

	.worker-active {
		color: var(--accent-primary, #00d9ff);
	}

	.worker-waiting {
		color: #f0ad4e;
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}

	/* Scrollbar styling */
	.queue-list::-webkit-scrollbar {
		width: 6px;
	}

	.queue-list::-webkit-scrollbar-track {
		background: transparent;
	}

	.queue-list::-webkit-scrollbar-thumb {
		background: var(--surface-border, #30363d);
	}

	.queue-list::-webkit-scrollbar-thumb:hover {
		background: var(--text-secondary, #8b949e);
	}
</style>
