<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import LoopHelp from './LoopHelp.svelte';

	interface EvidenceResponse {
		ok?: boolean;
		error?: string;
		evidence?: {
			ref: string;
			kind: string;
			label: string;
			found: boolean;
			claimBoundary?: string;
			data?: unknown;
		};
	}

	interface Props {
		refValue: string;
		chipKey?: string;
		compact?: boolean;
	}

	let { refValue, chipKey = '', compact = false }: Props = $props();
	let open = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let evidence = $state<EvidenceResponse['evidence'] | null>(null);

	async function inspectEvidence() {
		open = !open;
		if (!open || evidence || loading) return;
		loading = true;
		error = null;
		try {
			const url = `/api/loop-engineering/evidence?ref=${encodeURIComponent(refValue)}${chipKey ? `&chipKey=${encodeURIComponent(chipKey)}` : ''}`;
			const response = await fetch(url);
			const body = await response.json().catch(() => ({}));
			if (!response.ok || !body?.ok) throw new Error(body?.error || `Evidence lookup failed (${response.status})`);
			evidence = body.evidence;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Evidence lookup failed.';
		} finally {
			loading = false;
		}
	}

	function copyRef() {
		navigator.clipboard?.writeText(refValue).catch(() => {});
	}
</script>

<div class={compact ? 'min-w-0 max-w-full' : 'min-w-0 max-w-full border border-surface-border bg-bg-primary p-2'}>
	<div class="flex min-w-0 items-center gap-2">
		<button
			type="button"
			class="min-w-0 flex-1 truncate text-left font-mono text-[11px] text-text-secondary hover:text-accent-primary"
			onclick={inspectEvidence}
			title={refValue}
		>
			{refValue}
		</button>
		<button type="button" class="shrink-0 text-text-tertiary hover:text-accent-primary" aria-label="Copy evidence ref" onclick={copyRef}>
			<Icon name="copy" size={13} />
		</button>
		<LoopHelp text="Open this evidence reference inside Spawner. Control-plane refs resolve to local private packet data; mission and trace refs stay as references." label="Evidence ref help" />
	</div>
	{#if open}
		<div class="mt-2 border-t border-surface-border pt-2 text-xs text-text-secondary">
			{#if loading}
				<p class="font-mono text-text-tertiary">loading evidence...</p>
			{:else if error}
				<p class="text-status-error">{error}</p>
			{:else if evidence}
				<div class="flex flex-wrap items-center gap-2">
					<span class="border border-surface-border bg-bg-secondary px-2 py-1 font-mono text-[10px] text-text-tertiary">{evidence.kind}</span>
					<span class="border {evidence.found ? 'border-status-success/30 bg-status-success-bg text-status-success' : 'border-status-warning/30 bg-status-warning-bg text-status-warning'} px-2 py-1 font-mono text-[10px]">
						{evidence.found ? 'found' : 'reference only'}
					</span>
				</div>
				{#if evidence.claimBoundary}
					<p class="mt-2 text-text-tertiary">{evidence.claimBoundary}</p>
				{/if}
				{#if evidence.data}
					<pre class="mt-2 max-h-72 overflow-auto whitespace-pre-wrap border border-surface-border bg-bg-secondary p-2 font-mono text-[11px] text-text-secondary">{JSON.stringify(evidence.data, null, 2)}</pre>
				{/if}
			{/if}
		</div>
	{/if}
</div>
