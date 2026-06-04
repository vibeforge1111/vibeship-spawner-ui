<script lang="ts">
	import { logger } from '$lib/utils/logger';
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { syncClient } from '$lib/services/sync-client';
	import { initPipelines } from '$lib/stores/pipelines.svelte';
	import { initPersistence } from '$lib/services/persistence';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children } = $props();
	let isOffline = $state(false);

	function handleOffline(): void { isOffline = true; }
	function handleOnline(): void { isOffline = false; }

	// Initialize app state and optional local sync on app load
	onMount(async () => {
		if (!browser) return;

		// Initialize persistence system (schema migrations, etc.)
		const persistence = initPersistence();
		if (persistence.migrated) {
			logger.info(`[App] Data migrated from v${persistence.fromVersion} to v${persistence.toVersion}`);
		}

		// Initialize pipeline system (ensures localStorage is loaded)
		initPipelines();

		const syncWsUrl = import.meta.env.PUBLIC_SYNC_WS_URL?.trim();
		if (syncWsUrl) {
			tryConnectSync(syncWsUrl);
		}

		// Network reachability: surface offline state in a banner instead
		// of letting the operator see a generic "fetch failed" toast from
		// each route's poller. navigator.onLine is the standard browser
		// signal; online/offline events fire on transition.
		isOffline = !navigator.onLine;
		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
	});

	// Try to connect WebSocket for real-time sync
	async function tryConnectSync(wsUrl: string) {
		syncClient.configure({ wsUrl });
		const connected = await syncClient.connect();
		if (connected) {
			logger.info('[Sync] Real-time sync connected');
		} else {
			logger.info('[Sync] WebSocket not available, using polling');
		}
	}

	// Cleanup on unmount
	onDestroy(() => {
		if (browser) {
			syncClient.disconnect();
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/logo.png" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
	<title>Spawner - Visual Orchestration for AI Skill Chains</title>
	<meta name="description" content="Build AI workflows visually. Connect skills, validate with sharp edges, deploy anywhere." />
</svelte:head>

{#if isOffline}
	<div role="status" aria-live="polite" class="sticky top-0 z-[60] w-full border-b border-status-warning/40 bg-status-warning-bg px-4 py-2 text-center font-mono text-xs text-status-warning">
		You're offline. The spawner UI keeps working from local state, but live sync, fetches, and polling will retry when your network returns.
	</div>
{/if}

{@render children()}
<ToastContainer />
