<script lang="ts">
	import { onMount } from 'svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import {
		teamRegistry,
		activeTeam,
		allAgents,
		commanders,
		specialists,
		setActiveTeam,
		getTeamSkills,
		initializeRuntime,
		teamRuntime,
		stopRuntime
	} from '$lib/services/agentic-teams';
	import type { AgenticTeam, Agent, Division } from '$lib/types/teams';

	let selectedDivision: string | null = null;
	let selectedAgent: Agent | null = null;
	let mindConnected = false;
	let skillCount = 0;

	// Load the default Vibeship team
	onMount(async () => {
		try {
			const response = await fetch('/api/teams');
			if (response.ok) {
				const data = await response.json();
				teamRegistry.set(data);
				if (data.teams.length > 0) {
					setActiveTeam(data.teams[0].id);
					skillCount = getTeamSkills().length;
				}
			}
		} catch (e) {
			console.error('Failed to load teams:', e);
		}

		// Check Mind connection
		try {
			const healthRes = await fetch('http://localhost:8080/health');
			mindConnected = healthRes.ok;
		} catch {
			mindConnected = false;
		}
	});

	function selectDivision(divId: string) {
		selectedDivision = selectedDivision === divId ? null : divId;
		selectedAgent = null;
	}

	function selectAgent(agent: Agent) {
		selectedAgent = selectedAgent?.id === agent.id ? null : agent;
	}

	function getRoleColor(role: string): string {
		return role === 'Commander' ? 'text-amber-400' : 'text-blue-400';
	}

	function getDivisionColor(divId: string): string {
		const colors: Record<string, string> = {
			content: 'border-purple-500/50 hover:border-purple-500',
			product: 'border-blue-500/50 hover:border-blue-500',
			community: 'border-green-500/50 hover:border-green-500',
			research: 'border-cyan-500/50 hover:border-cyan-500',
			growth: 'border-orange-500/50 hover:border-orange-500',
			operations: 'border-gray-500/50 hover:border-gray-500'
		};
		return colors[divId] || 'border-surface-border';
	}

	function handleStartTeam() {
		if ($activeTeam) {
			initializeRuntime($activeTeam.id);
		}
	}

	function handleStopTeam() {
		stopRuntime();
	}
</script>

<svelte:head>
	<title>Agentic Teams - Spawner</title>
</svelte:head>

<Navbar />

<div class="min-h-screen bg-bg-primary">
	<section class="max-w-7xl mx-auto px-6 pt-16 pb-12">
		<!-- Header -->
		<div class="flex items-center justify-between mb-8">
			<div>
				<a href="/tools" class="text-text-tertiary hover:text-text-secondary text-sm mb-2 inline-block">
					← Back to Tools
				</a>
				<h1 class="text-3xl font-serif text-text-primary">Agentic Teams</h1>
				<p class="text-text-secondary mt-1">
					Orchestrate multi-agent teams with H70 skills and Mind v5 memory
				</p>
			</div>
			<div class="flex items-center gap-4">
				<!-- Status indicators -->
				<div class="flex items-center gap-2 text-sm">
					<span class={mindConnected ? 'text-green-400' : 'text-red-400'}>●</span>
					<span class="text-text-tertiary">Mind v5</span>
				</div>
				<div class="flex items-center gap-2 text-sm">
					<span class="text-green-400">●</span>
					<span class="text-text-tertiary">H70 MCP</span>
				</div>
			</div>
		</div>

		{#if $activeTeam}
			<!-- Team Overview -->
			<div class="bg-bg-secondary border border-surface-border p-6 mb-8">
				<div class="flex items-center justify-between mb-4">
					<div>
						<h2 class="text-xl font-serif text-text-primary">{$activeTeam.name}</h2>
						<p class="text-text-secondary text-sm">{$activeTeam.description}</p>
					</div>
					<div class="flex items-center gap-3">
						{#if $teamRuntime?.is_running}
							<button
								on:click={handleStopTeam}
								class="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 transition-colors text-sm font-mono"
							>
								Stop Team
							</button>
						{:else}
							<button
								on:click={handleStartTeam}
								class="px-4 py-2 bg-accent-primary/20 text-accent-primary border border-accent-primary/50 hover:bg-accent-primary/30 transition-colors text-sm font-mono"
							>
								Start Team
							</button>
						{/if}
					</div>
				</div>

				<!-- Stats -->
				<div class="grid grid-cols-5 gap-4">
					<div class="bg-bg-primary p-4 border border-surface-border">
						<div class="text-2xl font-mono text-text-primary">{$activeTeam.stats.total_agents}</div>
						<div class="text-xs text-text-tertiary">Total Agents</div>
					</div>
					<div class="bg-bg-primary p-4 border border-surface-border">
						<div class="text-2xl font-mono text-amber-400">{$activeTeam.stats.commanders}</div>
						<div class="text-xs text-text-tertiary">Commanders</div>
					</div>
					<div class="bg-bg-primary p-4 border border-surface-border">
						<div class="text-2xl font-mono text-blue-400">{$activeTeam.stats.specialists}</div>
						<div class="text-xs text-text-tertiary">Specialists</div>
					</div>
					<div class="bg-bg-primary p-4 border border-surface-border">
						<div class="text-2xl font-mono text-text-primary">{$activeTeam.stats.divisions}</div>
						<div class="text-xs text-text-tertiary">Divisions</div>
					</div>
					<div class="bg-bg-primary p-4 border border-surface-border">
						<div class="text-2xl font-mono text-purple-400">{skillCount}</div>
						<div class="text-xs text-text-tertiary">H70 Skills</div>
					</div>
				</div>
			</div>

			<!-- Divisions Grid -->
			<div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
				{#each Object.entries($activeTeam.divisions) as [divId, division]}
					<button
						on:click={() => selectDivision(divId)}
						class="text-left bg-bg-secondary border {getDivisionColor(divId)} p-4 transition-all {selectedDivision === divId ? 'ring-2 ring-accent-primary' : ''}"
					>
						<div class="flex items-center justify-between mb-2">
							<h3 class="font-serif text-text-primary">{division.name}</h3>
							<span class="text-xs font-mono text-text-tertiary">{division.agents.length} agents</span>
						</div>
						<p class="text-text-secondary text-sm mb-3">{division.description}</p>
						<div class="flex items-center gap-2">
							<span class="text-xs font-mono px-2 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30">
								{division.commander}
							</span>
						</div>
					</button>
				{/each}
			</div>

			<!-- Selected Division Detail -->
			{#if selectedDivision && $activeTeam.divisions[selectedDivision]}
				{@const division = $activeTeam.divisions[selectedDivision]}
				<div class="bg-bg-secondary border border-surface-border p-6 mb-8">
					<h3 class="text-lg font-serif text-text-primary mb-4">{division.name} Agents</h3>
					<div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
						{#each division.agents as agent}
							<button
								on:click={() => selectAgent(agent)}
								class="text-left p-4 border border-surface-border hover:border-accent-primary/50 transition-all bg-bg-primary {selectedAgent?.id === agent.id ? 'ring-2 ring-accent-primary' : ''}"
							>
								<div class="flex items-center gap-2 mb-2">
									<span class="text-xs font-mono {getRoleColor(agent.role)}">{agent.role}</span>
								</div>
								<h4 class="text-text-primary font-medium">{agent.id}</h4>
								<div class="flex flex-wrap gap-1 mt-2">
									{#each agent.h70_skills.slice(0, 2) as skill}
										<span class="text-xs font-mono px-1.5 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30">
											{skill}
										</span>
									{/each}
									{#if agent.h70_skills.length > 2}
										<span class="text-xs text-text-tertiary">+{agent.h70_skills.length - 2}</span>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Selected Agent Detail -->
			{#if selectedAgent}
				<div class="bg-bg-secondary border border-accent-primary/50 p-6">
					<div class="flex items-center justify-between mb-4">
						<div>
							<span class="text-xs font-mono {getRoleColor(selectedAgent.role)} mb-1 block">{selectedAgent.role}</span>
							<h3 class="text-xl font-serif text-text-primary">{selectedAgent.id}</h3>
						</div>
						<div class="text-right">
							<div class="text-xs text-text-tertiary">Division</div>
							<div class="text-text-secondary">{selectedAgent.division}</div>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-6">
						<!-- H70 Skills -->
						<div>
							<h4 class="text-sm font-mono text-text-tertiary mb-2">H70 Skills</h4>
							<div class="flex flex-wrap gap-2">
								{#each selectedAgent.h70_skills as skill}
									<span class="text-sm font-mono px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30">
										{skill}
									</span>
								{/each}
							</div>
						</div>

						<!-- Reports To -->
						<div>
							<h4 class="text-sm font-mono text-text-tertiary mb-2">Reports To</h4>
							{#if selectedAgent.role === 'Commander'}
								<span class="text-text-secondary">CEO</span>
							{:else}
								<span class="text-amber-400 font-mono">{selectedDivision}-commander</span>
							{/if}
						</div>
					</div>

					<!-- File Path -->
					<div class="mt-4 pt-4 border-t border-surface-border">
						<span class="text-xs font-mono text-text-tertiary">
							{selectedAgent.file}
						</span>
					</div>
				</div>
			{/if}

			<!-- Key Handoffs -->
			<div class="mt-8">
				<h3 class="text-lg font-serif text-text-primary mb-4">Key Handoffs</h3>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each $activeTeam.key_handoffs as handoff}
						<div class="bg-bg-secondary border border-surface-border p-4 flex items-center gap-4">
							<span class="font-mono text-blue-400 text-sm">{handoff.from}</span>
							<span class="text-text-tertiary">→</span>
							<span class="font-mono text-green-400 text-sm">{handoff.to}</span>
							<span class="text-xs text-text-tertiary ml-auto">{handoff.trigger}</span>
						</div>
					{/each}
				</div>
			</div>

		{:else}
			<!-- No team loaded -->
			<div class="bg-bg-secondary border border-surface-border p-12 text-center">
				<p class="text-text-secondary mb-4">No team loaded</p>
				<p class="text-text-tertiary text-sm">Configure your team in the API endpoint</p>
			</div>
		{/if}
	</section>
</div>
