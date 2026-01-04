<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { mcpState, connect, connectLocal, setMcpUrl } from '$lib/stores/mcp.svelte';

	let status = $state<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
	let error = $state<string | null>(null);
	let customUrl = $state('http://localhost:8787');

	$effect(() => {
		const unsub = mcpState.subscribe((s) => {
			status = s.status;
			error = s.error;
		});
		return unsub;
	});

	async function handleConnect() {
		setMcpUrl(customUrl);
		await connect();
	}

	async function handleQuickConnect() {
		await connectLocal();
	}

	const steps = [
		{
			title: 'Clone the Spawner MCP Server',
			code: 'git clone https://github.com/vibeship/spawner-v2.git\ncd spawner-v2',
			description: 'Get the MCP server code from GitHub'
		},
		{
			title: 'Install Dependencies',
			code: 'npm install',
			description: 'Install all required packages'
		},
		{
			title: 'Start the Development Server',
			code: 'npm run dev',
			description: 'Runs on http://localhost:8787 by default'
		},
		{
			title: 'Configure Claude Code',
			code: `// Add to your claude_desktop_config.json
{
  "mcpServers": {
    "spawner": {
      "command": "npx",
      "args": ["wrangler", "dev"],
      "cwd": "/path/to/spawner-v2"
    }
  }
}`,
			description: 'Optional: Add to Claude Desktop for native integration'
		}
	];
</script>

<svelte:head>
	<title>MCP Setup Guide - Vibeship Spawner</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-bg-primary">
	<Navbar />

	<main class="flex-1 py-16">
		<div class="max-w-4xl mx-auto px-6">
			<!-- Header -->
			<div class="mb-12">
				<h1 class="font-serif text-4xl text-text-primary mb-4">MCP Setup Guide</h1>
				<p class="text-text-secondary text-lg">
					Connect Spawner UI to the MCP server for live skill management and workflow execution.
				</p>
			</div>

			<!-- Connection Status -->
			<div class="mb-12 p-6 border border-surface-border bg-bg-secondary">
				<h2 class="font-serif text-xl text-text-primary mb-4">Connection Status</h2>

				<div class="flex items-center gap-4 mb-4">
					<div
						class="w-3 h-3 rounded-full"
						class:bg-accent-primary={status === 'connected'}
						class:bg-yellow-500={status === 'connecting'}
						class:bg-red-500={status === 'error'}
						class:bg-text-tertiary={status === 'disconnected'}
					></div>
					<span class="font-mono text-text-primary">
						{status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : status === 'error' ? 'Error' : 'Disconnected'}
					</span>
				</div>

				{#if error}
					<p class="text-red-400 text-sm mb-4">{error}</p>
				{/if}

				<div class="flex items-end gap-4">
					<div class="flex-1">
						<label for="mcp-url" class="block text-xs text-text-tertiary mb-1">MCP Server URL</label>
						<input
							id="mcp-url"
							type="text"
							bind:value={customUrl}
							class="w-full px-3 py-2 bg-surface border border-surface-border text-text-primary font-mono text-sm focus:outline-none focus:border-accent-primary"
						/>
					</div>
					<button
						onclick={handleConnect}
						disabled={status === 'connecting'}
						class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50"
					>
						{status === 'connecting' ? 'Connecting...' : 'Connect'}
					</button>
				</div>

				<div class="mt-4 pt-4 border-t border-surface-border">
					<button
						onclick={handleQuickConnect}
						disabled={status === 'connecting'}
						class="text-sm text-accent-primary hover:underline"
					>
						Quick connect to localhost:8787
					</button>
				</div>
			</div>

			<!-- Setup Steps -->
			<div class="mb-12">
				<h2 class="font-serif text-2xl text-text-primary mb-6">Setup Instructions</h2>

				<div class="space-y-6">
					{#each steps as step, index}
						<div class="p-6 border border-surface-border bg-bg-secondary">
							<div class="flex items-start gap-4">
								<div class="w-8 h-8 flex items-center justify-center border border-accent-primary text-accent-primary font-mono text-sm flex-shrink-0">
									{index + 1}
								</div>
								<div class="flex-1">
									<h3 class="font-medium text-text-primary mb-2">{step.title}</h3>
									<p class="text-sm text-text-secondary mb-3">{step.description}</p>
									<pre class="p-4 bg-bg-primary border border-surface-border overflow-x-auto text-sm font-mono text-text-primary"><code>{step.code}</code></pre>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Features -->
			<div class="mb-12">
				<h2 class="font-serif text-2xl text-text-primary mb-6">What You Can Do</h2>

				<div class="grid md:grid-cols-2 gap-4">
					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">/skills</h3>
						<p class="text-sm text-text-secondary">Browse and search 450+ skills with live data from the MCP server</p>
					</div>
					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">/canvas</h3>
						<p class="text-sm text-text-secondary">Build visual workflows by connecting skills together</p>
					</div>
					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">/builder</h3>
						<p class="text-sm text-text-secondary">Configure agents and MCP servers for your project</p>
					</div>
					<div class="p-4 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Chat Commands</h3>
						<p class="text-sm text-text-secondary">Use /help in the canvas chat to call MCP tools directly</p>
					</div>
				</div>
			</div>

			<!-- Troubleshooting -->
			<div>
				<h2 class="font-serif text-2xl text-text-primary mb-6">Troubleshooting</h2>

				<div class="space-y-4">
					<div class="p-4 border border-surface-border">
						<h3 class="font-medium text-text-primary mb-2">Connection refused</h3>
						<p class="text-sm text-text-secondary">
							Make sure the MCP server is running with <code class="bg-surface px-1">npm run dev</code> in the spawner-v2 directory.
						</p>
					</div>
					<div class="p-4 border border-surface-border">
						<h3 class="font-medium text-text-primary mb-2">CORS errors</h3>
						<p class="text-sm text-text-secondary">
							The MCP server should handle CORS automatically. If you see CORS errors, check that you're using the correct port.
						</p>
					</div>
					<div class="p-4 border border-surface-border">
						<h3 class="font-medium text-text-primary mb-2">Skills not loading</h3>
						<p class="text-sm text-text-secondary">
							The UI falls back to static skills.json if MCP is unavailable. Connect to MCP for live skill data.
						</p>
					</div>
				</div>
			</div>
		</div>
	</main>

	<Footer />
</div>
