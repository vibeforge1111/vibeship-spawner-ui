<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { mcpState, connect, setMcpUrl, connectLocal, connectProduction } from '$lib/stores/mcp.svelte';
	import { syncClient } from '$lib/services/sync-client';
	import ToastContainer from '$lib/components/ToastContainer.svelte';

	let { children } = $props();

	// Auto-connect to MCP and Sync on app load
	onMount(async () => {
		if (!browser) return;

		// Check for saved preference
		const savedUrl = localStorage.getItem('mcp-url');

		if (savedUrl) {
			// Use saved URL preference
			setMcpUrl(savedUrl);
			const success = await connect();
			if (success) {
				console.log('[MCP] Connected to saved server:', savedUrl);
				// Also try WebSocket sync
				tryConnectSync(savedUrl.replace('http', 'ws') + '/sync');
				return;
			}
		}

		// Try local first (for development)
		console.log('[MCP] Attempting local connection...');
		const localSuccess = await connectLocal();
		if (localSuccess) {
			localStorage.setItem('mcp-url', 'http://localhost:8787');
			console.log('[MCP] Connected to local server');
			// Try WebSocket sync for real-time updates
			tryConnectSync('ws://localhost:8787/sync');
			return;
		}

		// Fall back to production
		console.log('[MCP] Local failed, trying production...');
		const prodSuccess = await connectProduction();
		if (prodSuccess) {
			localStorage.setItem('mcp-url', 'https://mcp.vibeship.co');
			console.log('[MCP] Connected to production server');
			// Try WebSocket sync
			tryConnectSync('wss://mcp.vibeship.co/sync');
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
