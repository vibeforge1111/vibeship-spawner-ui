<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { syncClient } from '$lib/services/sync-client';
	import { initPipelines } from '$lib/stores/pipelines.svelte';
	import { initPersistence } from '$lib/services/persistence';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children } = $props();

	// Initialize app state and optional local sync on app load
	onMount(async () => {
		if (!browser) return;

		// Initialize persistence system (schema migrations, etc.)
		const persistence = initPersistence();
		if (persistence.migrated) {
			console.log(`[App] Data migrated from v${persistence.fromVersion} to v${persistence.toVersion}`);
		}

		// Initialize pipeline system (ensures localStorage is loaded)
		initPipelines();

		// Keep canvas sync available when the local bridge is running.
		tryConnectSync('ws://localhost:8787/sync');
	});

	// Try to connect WebSocket for real-time sync
	async function tryConnectSync(wsUrl: string) {
		syncClient.configure({ wsUrl });
		const connected = await syncClient.connect();
		if (connected) {
			console.log('[Sync] Real-time sync connected');
		} else {
			console.log('[Sync] WebSocket not available, using polling');
		}
	}

	// Cleanup on unmount
	onDestroy(() => {
		if (browser) {
			syncClient.disconnect();
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

{@render children()}
<ToastContainer />
