<script lang="ts">
	import Icon from './Icon.svelte';
	import PipelineSelector from './PipelineSelector.svelte';
	import { mcpState, isConnected, isConnecting } from '$lib/stores/mcp.svelte';
	import { initPipelines } from '$lib/stores/pipelines.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let skillsDropdownOpen = $state(false);
	let currentMcpState = $state({ status: 'disconnected' as string, baseUrl: '' });
	let pipelinesReady = $state(false);

	// Initialize pipelines on mount
	onMount(() => {
		if (browser) {
			initPipelines();
			pipelinesReady = true;
		}
	});

	$effect(() => {
		const unsub = mcpState.subscribe((s) => {
			currentMcpState = { status: s.status, baseUrl: s.baseUrl };
		});
		return unsub;
	});

	function toggleSkillsDropdown() {
		skillsDropdownOpen = !skillsDropdownOpen;
	}

	function closeDropdown() {
		skillsDropdownOpen = false;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'connected': return 'bg-green-500';
			case 'connecting': return 'bg-yellow-500 animate-pulse';
			case 'error': return 'bg-red-500';
			default: return 'bg-gray-500';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'connected': return 'MCP Connected';
			case 'connecting': return 'Connecting...';
			case 'error': return 'Connection Failed';
			default: return 'Disconnected';
		}
	}
</script>

<svelte:window
	onclick={(e) => {
		const target = e.target as HTMLElement;
		if (!target.closest('.skills-dropdown-container')) {
			skillsDropdownOpen = false;
		}
	}}
/>

<nav class="h-[52px] sticky top-0 border-b border-surface-border bg-bg-primary z-50">
	<div class="h-full max-w-6xl mx-auto flex items-center justify-between px-6">
		<!-- Left side: Logo + Pipeline Selector -->
		<div class="flex items-center gap-4">
			<!-- Logo -->
			<a href="/" class="flex items-center gap-1.5">
				<img src="/logo.png" alt="vibeship" class="w-6 h-6 -ml-0.5" />
				<span class="font-serif text-[1.36rem] text-text-primary" style="font-family: 'Instrument Serif', Georgia, serif;">vibeship</span>
				<span class="font-serif text-[1.36rem] text-accent-primary" style="font-family: 'Instrument Serif', Georgia, serif;">spawner</span>
			</a>

			<!-- Divider -->
			<div class="w-px h-5 bg-surface-border hidden md:block"></div>

			<!-- Pipeline Selector - Navigate to canvas on switch -->
			{#if pipelinesReady}
				<div class="hidden md:block">
					<PipelineSelector navigateOnSwitch={true} />
				</div>
			{/if}
		</div>

		<!-- Right side -->
		<div class="flex items-center gap-2">
			<!-- MCP Status Indicator -->
			<div class="group relative flex items-center gap-1.5 px-2 py-1.5" title={getStatusText(currentMcpState.status)}>
				<span class="w-2 h-2 rounded-full {getStatusColor(currentMcpState.status)}"></span>
				<span class="hidden lg:inline font-mono text-xs text-text-tertiary group-hover:text-text-secondary transition-colors">
					{currentMcpState.status === 'connected' ? 'MCP' : currentMcpState.status === 'connecting' ? '...' : 'offline'}
				</span>
				<!-- Tooltip on hover -->
				<div class="absolute top-full right-0 mt-1 px-2 py-1 bg-bg-secondary border border-surface-border text-xs font-mono text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
					{getStatusText(currentMcpState.status)}
					{#if currentMcpState.status === 'connected'}
						<span class="text-text-tertiary block">{currentMcpState.baseUrl.replace('http://', '').replace('https://', '')}</span>
					{/if}
				</div>
			</div>

			<div class="w-px h-4 bg-surface-border"></div>

			<!-- Project link -->
			<a
				href="/project"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/10 transition-all"
			>
				<Icon name="file-text" size={14} />
				<span class="hidden sm:inline">Project</span>
			</a>

			<!-- Guide link -->
			<a
				href="/guide"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="book" size={14} />
				<span class="hidden sm:inline">Guide</span>
			</a>

			<!-- Missions link -->
			<a
				href="/missions"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="rocket" size={14} />
				<span class="hidden sm:inline">Missions</span>
			</a>

			<!-- Mind link -->
			<a
				href="/mind"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="brain" size={14} />
				<span class="hidden sm:inline">Mind</span>
			</a>

			<!-- Settings link -->
			<a
				href="/settings"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="settings" size={14} />
				<span class="hidden sm:inline">Settings</span>
			</a>

			<!-- Skills Dropdown -->
			<div class="skills-dropdown-container relative">
				<button
					class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all cursor-pointer bg-transparent"
					onclick={toggleSkillsDropdown}
				>
					<Icon name="layers" size={14} />
					<span class="hidden sm:inline">Skills</span>
					<Icon name="chevron-down" size={12} />
				</button>

				{#if skillsDropdownOpen}
					<div class="absolute top-full right-0 mt-1 min-w-[180px] bg-bg-primary border border-surface-border shadow-lg py-2 z-50 animate-fade-in">
						<a
							href="/skills"
							class="flex items-center gap-2 px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							<Icon name="grid" size={14} />
							<span>Browse All</span>
						</a>
						<a
							href="/skills/find"
							class="flex items-center gap-2 px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							<Icon name="compass" size={14} />
							<span>Find a Skill</span>
						</a>
						<a
							href="/skills/create"
							class="flex items-center gap-2 px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							<Icon name="plus" size={14} />
							<span>Create Your Own</span>
						</a>

						<div class="h-px bg-surface-border my-2"></div>

						<div class="px-4 py-1 font-mono text-[0.7rem] uppercase tracking-wider text-text-tertiary">
							Categories
						</div>
						<a
							href="/skills?category=development"
							class="block px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							Development
						</a>
						<a
							href="/skills?category=frameworks"
							class="block px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							Frameworks
						</a>
						<a
							href="/skills?category=design"
							class="block px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							Design
						</a>
						<a
							href="/skills?category=strategy"
							class="block px-4 py-2 font-mono text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors"
							onclick={closeDropdown}
						>
							Strategy
						</a>
					</div>
				{/if}
			</div>

			<!-- GitHub link -->
			<a
				href="https://github.com/vibeforge1111/vibeship-spawner-ui"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
				target="_blank"
				rel="noopener"
			>
				<Icon name="github" size={16} />
				<span class="hidden sm:inline">GitHub</span>
			</a>
		</div>
	</div>
</nav>
