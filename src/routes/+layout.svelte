<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { mcpState, connect, setMcpUrl, connectLocal, connectProduction } from '$lib/stores/mcp.svelte';
	import { syncClient } from '$lib/services/sync-client';
	import { initializeMemory } from '$lib/stores/memory-settings.svelte';
	import { initPipelines } from '$lib/stores/pipelines.svelte';
	import { initPersistence } from '$lib/services/persistence';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children } = $props();

	// Auto-connect to MCP, Sync, and Mind on app load
	onMount(async () => {
		if (!browser) return;

		// Initialize persistence system (schema migrations, etc.)
		const persistence = initPersistence();
		if (persistence.migrated) {
			console.log(`[App] Data migrated from v${persistence.fromVersion} to v${persistence.toVersion}`);
		}

		// Initialize pipeline system (ensures localStorage is loaded)
		initPipelines();

		// Always try local sync first (for canvas bridge during development)
		// This runs in parallel with MCP connection
		tryConnectSync('ws://localhost:8787/sync');

		// Initialize Mind memory system (connects to local Mind API if available)
		initializeMemory().then(connected => {
			if (connected) {
				console.log('[Mind] Connected to memory API');
			} else {
				console.log('[Mind] Memory API not available, learnings will not persist');
			}
		}).catch(err => {
			console.log('[Mind] Memory initialization failed:', err);
		});

		// Check for saved preference
		const savedUrl = localStorage.getItem('mcp-url');

		if (savedUrl) {
			// Use saved URL preference
			setMcpUrl(savedUrl);
			const success = await connect();
			if (success) {
				console.log('[MCP] Connected to saved server:', savedUrl);
				return;
			}
		}

		// Try local first (for development)
		console.log('[MCP] Attempting local connection...');
		const localSuccess = await connectLocal();
		if (localSuccess) {
			localStorage.setItem('mcp-url', 'http://localhost:8787');
			console.log('[MCP] Connected to local server');
			return;
		}

		// Fall back to production
		console.log('[MCP] Local failed, trying production...');
		const prodSuccess = await connectProduction();
		if (prodSuccess) {
			localStorage.setItem('mcp-url', 'https://mcp.vibeship.co');
			console.log('[MCP] Connected to production server');
			return;
		}

		// Neither worked - app will use static fallbacks
		console.log('[MCP] No server available, using static data');
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
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
	<title>Spawner - Visual Orchestration for AI Skill Chains</title>
	<meta name="description" content="Build AI workflows visually. Connect skills, validate with sharp edges, deploy anywhere." />
</svelte:head>

{@render children()}
<ToastContainer />
