<script lang="ts">
	import type { Memory } from '$lib/types/memory';

	interface Props {
		learnings: Memory[];
		onFilter: (filtered: Memory[]) => void;
	}

	let { learnings, onFilter }: Props = $props();

	// Filter state
	let searchQuery = $state('');
	let selectedType = $state<'all' | 'success' | 'failure' | 'optimization'>('all');
	let selectedAgent = $state<string>('all');
	let selectedSkill = $state<string>('all');
	let sortOrder = $state<'newest' | 'oldest' | 'confidence'>('newest');
	let showFilters = $state(false);

	// Extract unique agents and skills from learnings
	let uniqueAgents = $derived(() => {
		const agents = new Set<string>();
		for (const learning of learnings) {
			const meta = learning.metadata as { agent_id?: string; agent_name?: string } | undefined;
			if (meta?.agent_id) {
				agents.add(meta.agent_name || meta.agent_id);
			}
		}
		return Array.from(agents).sort();
	});

	let uniqueSkills = $derived(() => {
		const skills = new Set<string>();
		for (const learning of learnings) {
			const meta = learning.metadata as { skill_id?: string } | undefined;
			if (meta?.skill_id) {
				skills.add(meta.skill_id);
			}
		}
		return Array.from(skills).sort();
	});

	// Apply filters
	$effect(() => {
		let filtered = [...learnings];

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(l => {
				const meta = l.metadata as { reasoning?: string; skill_id?: string } | undefined;
				return (
					l.content.toLowerCase().includes(query) ||
					meta?.reasoning?.toLowerCase().includes(query) ||
					meta?.skill_id?.toLowerCase().includes(query)
				);
			});
		}

		// Type filter
		if (selectedType !== 'all') {
			filtered = filtered.filter(l => {
				const meta = l.metadata as { pattern_type?: string } | undefined;
				return meta?.pattern_type === selectedType;
			});
		}

		// Agent filter
		if (selectedAgent !== 'all') {
			filtered = filtered.filter(l => {
				const meta = l.metadata as { agent_id?: string; agent_name?: string } | undefined;
				return (meta?.agent_name || meta?.agent_id) === selectedAgent;
			});
		}

		// Skill filter
		if (selectedSkill !== 'all') {
			filtered = filtered.filter(l => {
				const meta = l.metadata as { skill_id?: string } | undefined;
				return meta?.skill_id === selectedSkill;
			});
		}

		// Sort
		if (sortOrder === 'newest') {
			filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
		} else if (sortOrder === 'oldest') {
			filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
		} else if (sortOrder === 'confidence') {
			filtered.sort((a, b) => {
				const confA = (a.metadata as { confidence?: number } | undefined)?.confidence ?? a.effective_salience;
				const confB = (b.metadata as { confidence?: number } | undefined)?.confidence ?? b.effective_salience;
				return confB - confA;
			});
		}

		onFilter(filtered);
	});

	let activeFilterCount = $derived(() => {
		let count = 0;
		if (searchQuery.trim()) count++;
		if (selectedType !== 'all') count++;
		if (selectedAgent !== 'all') count++;
		if (selectedSkill !== 'all') count++;
		return count;
	});

	function clearFilters() {
		searchQuery = '';
		selectedType = 'all';
		selectedAgent = 'all';
		selectedSkill = 'all';
	}
</script>

<div class="border border-surface-border bg-bg-secondary mb-4">
	<!-- Search and Toggle Bar -->
	<div class="flex items-center gap-3 p-3">
		<!-- Search -->
		<div class="flex-1 relative">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search learnings..."
				class="w-full pl-8 pr-3 py-1.5 text-sm font-mono bg-bg-primary border border-surface-border text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
			/>
			<svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
			</svg>
		</div>

		<!-- Filter Toggle -->
		<button
			onclick={() => showFilters = !showFilters}
			class="flex items-center gap-2 px-3 py-1.5 text-sm font-mono border transition-all"
			class:border-accent-primary={activeFilterCount() > 0}
			class:text-accent-primary={activeFilterCount() > 0}
			class:border-surface-border={activeFilterCount() === 0}
			class:text-text-secondary={activeFilterCount() === 0}
			class:hover:border-text-tertiary={activeFilterCount() === 0}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
			</svg>
			Filters
			{#if activeFilterCount() > 0}
				<span class="px-1.5 py-0.5 text-[10px] bg-accent-primary text-bg-primary rounded-sm">
					{activeFilterCount()}
				</span>
			{/if}
		</button>

		<!-- Sort -->
		<select
			bind:value={sortOrder}
			class="px-3 py-1.5 text-sm font-mono bg-bg-primary border border-surface-border text-text-secondary focus:outline-none focus:border-accent-primary"
		>
			<option value="newest">Newest first</option>
			<option value="oldest">Oldest first</option>
			<option value="confidence">By confidence</option>
		</select>
	</div>

	<!-- Expanded Filters -->
	{#if showFilters}
		<div class="px-3 pb-3 pt-1 border-t border-surface-border space-y-3">
			<div class="flex flex-wrap gap-4">
				<!-- Type Filter -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Type:</span>
					<div class="flex gap-1">
						{#each ['all', 'success', 'failure', 'optimization'] as type}
							<button
								onclick={() => selectedType = type as typeof selectedType}
								class="px-2 py-0.5 text-xs font-mono border transition-all"
								class:bg-accent-primary={selectedType === type}
								class:text-bg-primary={selectedType === type}
								class:border-accent-primary={selectedType === type}
								class:border-surface-border={selectedType !== type}
								class:text-text-secondary={selectedType !== type}
								class:hover:border-text-tertiary={selectedType !== type}
							>
								{type === 'all' ? 'All' : type === 'success' ? '+ Success' : type === 'failure' ? '! Failure' : '* Opt'}
							</button>
						{/each}
					</div>
				</div>

				<!-- Agent Filter -->
				{#if uniqueAgents().length > 0}
					<div class="flex items-center gap-2">
						<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Agent:</span>
						<select
							bind:value={selectedAgent}
							class="px-2 py-0.5 text-xs font-mono bg-bg-primary border border-surface-border text-text-secondary focus:outline-none focus:border-accent-primary"
						>
							<option value="all">All agents</option>
							{#each uniqueAgents() as agent}
								<option value={agent}>{agent}</option>
							{/each}
						</select>
					</div>
				{/if}

				<!-- Skill Filter -->
				{#if uniqueSkills().length > 0}
					<div class="flex items-center gap-2">
						<span class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Skill:</span>
						<select
							bind:value={selectedSkill}
							class="px-2 py-0.5 text-xs font-mono bg-bg-primary border border-surface-border text-text-secondary focus:outline-none focus:border-accent-primary"
						>
							<option value="all">All skills</option>
							{#each uniqueSkills() as skill}
								<option value={skill}>{skill}</option>
							{/each}
						</select>
					</div>
				{/if}
			</div>

			<!-- Clear Filters -->
			{#if activeFilterCount() > 0}
				<button
					onclick={clearFilters}
					class="text-xs font-mono text-text-tertiary hover:text-accent-primary transition-colors"
				>
					Clear all filters
				</button>
			{/if}
		</div>
	{/if}
</div>

<!-- Results Summary -->
<div class="flex items-center justify-between mb-3 text-xs font-mono text-text-tertiary">
	<span>
		Showing {learnings.length} learning{learnings.length !== 1 ? 's' : ''}
	</span>
	{#if activeFilterCount() > 0}
		<span>({activeFilterCount()} filter{activeFilterCount() !== 1 ? 's' : ''} applied)</span>
	{/if}
</div>
