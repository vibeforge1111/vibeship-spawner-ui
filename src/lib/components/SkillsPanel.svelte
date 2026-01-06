<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import { skills, loadSkills, loadSkillsStatic, type Skill } from '$lib/stores/skills.svelte';
	import { addNode, nodes, type CanvasNode } from '$lib/stores/canvas.svelte';

	type ViewMode = 'pipeline' | 'all';

	let searchQuery = $state('');
	let expandedCategory = $state<string | null>(null);
	let viewMode = $state<ViewMode>('pipeline');
	let allSkillsLoaded = $state(false);
	let allSkillsList = $state<Skill[]>([]);
	let currentNodes = $state<CanvasNode[]>([]);

	// Subscribe to canvas nodes
	$effect(() => {
		const unsub = nodes.subscribe((n) => (currentNodes = n));
		return unsub;
	});

	onMount(() => {
		loadSkills();
	});

	// Load all skills when switching to "all" view
	async function loadAllSkills() {
		if (allSkillsLoaded) return;

		try {
			// Fetch fresh from static JSON to get full catalog
			const response = await fetch('/skills.json');
			if (response.ok) {
				const data = await response.json();
				allSkillsList = data.map((s: any) => ({
					id: s.id,
					name: s.name,
					description: s.description || '',
					category: s.category,
					tier: s.tier || 'free',
					tags: s.tags || [],
					triggers: s.triggers || [],
					handoffs: s.handoffs || [],
					pairsWell: s.pairsWell || []
				}));
				allSkillsLoaded = true;
			}
		} catch (e) {
			console.error('[SkillsPanel] Failed to load all skills:', e);
		}
	}

	function handleViewChange(mode: ViewMode) {
		viewMode = mode;
		if (mode === 'all' && !allSkillsLoaded) {
			loadAllSkills();
		}
	}

	// Get skills in current pipeline (canvas nodes)
	const pipelineSkills = $derived(
		currentNodes.map((node) => node.skill)
	);

	// Get unique pipeline skill IDs for "already added" indicator
	const pipelineSkillIds = $derived(
		new Set(currentNodes.map((node) => node.skill.id))
	);

	const categoryIcons: Record<string, string> = {
		// Core categories
		development: 'cpu',
		frameworks: 'layers',
		integrations: 'zap',
		'ai-ml': 'brain',
		agents: 'sparkles',
		data: 'grid',
		design: 'compass',
		marketing: 'play',
		strategy: 'book',
		enterprise: 'shield',
		finance: 'trending-up',
		legal: 'book-open',
		science: 'flask',
		startup: 'rocket',
		
		// Additional categories from skills.json
		ai: 'brain',
		'ai-agents': 'sparkles',
		'ai-tools': 'cpu',
		backend: 'server',
		biotech: 'heart',
		blockchain: 'link',
		climate: 'sun',
		community: 'users',
		creative: 'palette',
		devops: 'settings',
		education: 'book',
		frontend: 'layout',
		'game-dev': 'play',
		hardware: 'cpu',
		maker: 'tool',
		mind: 'brain',
		product: 'package',
		security: 'shield',
		simulation: 'grid',
		space: 'star',
		testing: 'check',
		trading: 'trending-up'
	};

	// Choose source based on view mode
	const sourceSkills = $derived(
		viewMode === 'pipeline' ? pipelineSkills : allSkillsList
	);

	const filteredSkills = $derived(
		sourceSkills.filter(
			(skill) =>
				skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				skill.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
		)
	);

	const groupedSkills = $derived(() => {
		const groups: Record<string, Skill[]> = {};
		for (const skill of filteredSkills) {
			if (!groups[skill.category]) {
				groups[skill.category] = [];
			}
			groups[skill.category].push(skill);
		}
		return groups;
	});

	// Check if a skill is already in the pipeline
	function isInPipeline(skillId: string): boolean {
		return pipelineSkillIds.has(skillId);
	}

	function handleDragStart(e: DragEvent, skill: Skill) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData('application/json', JSON.stringify(skill));
		e.dataTransfer.effectAllowed = 'copy';
	}

	function handleAddToCanvas(skill: Skill) {
		addNode(skill, { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 });
	}

	function toggleCategory(category: string) {
		expandedCategory = expandedCategory === category ? null : category;
	}
</script>

<div class="skills-panel h-full flex flex-col">
	<!-- View Toggle Tabs -->
	<div class="flex border-b border-surface-border">
		<button
			class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-mono transition-colors"
			class:bg-bg-secondary={viewMode === 'pipeline'}
			class:text-accent-primary={viewMode === 'pipeline'}
			class:border-b-2={viewMode === 'pipeline'}
			class:border-accent-primary={viewMode === 'pipeline'}
			class:text-text-tertiary={viewMode !== 'pipeline'}
			class:hover:text-text-secondary={viewMode !== 'pipeline'}
			onclick={() => handleViewChange('pipeline')}
		>
			<Icon name="git-branch" size={12} />
			<span>Pipeline</span>
			<span class="text-[10px] px-1 py-0.5 rounded bg-surface">{pipelineSkills.length}</span>
		</button>
		<button
			class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-mono transition-colors"
			class:bg-bg-secondary={viewMode === 'all'}
			class:text-accent-primary={viewMode === 'all'}
			class:border-b-2={viewMode === 'all'}
			class:border-accent-primary={viewMode === 'all'}
			class:text-text-tertiary={viewMode !== 'all'}
			class:hover:text-text-secondary={viewMode !== 'all'}
			onclick={() => handleViewChange('all')}
		>
			<Icon name="grid" size={12} />
			<span>All</span>
			{#if allSkillsLoaded}
				<span class="text-[10px] px-1 py-0.5 rounded bg-surface">{allSkillsList.length}</span>
			{/if}
		</button>
	</div>

	<!-- Search -->
	<div class="p-3 border-b border-surface-border">
		<div class="relative">
			<div class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary">
				<Icon name="search" size={14} />
			</div>
			<input
				type="text"
				placeholder={viewMode === 'pipeline' ? "Search pipeline skills..." : "Search all skills..."}
				bind:value={searchQuery}
				class="w-full pl-8 pr-3 py-2 bg-bg-primary border border-surface-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
			/>
		</div>
	</div>

	<!-- Skills List -->
	<div class="flex-1 overflow-y-auto">
		{#each Object.entries(groupedSkills()) as [category, categorySkills]}
			<div class="border-b border-surface-border">
				<!-- Category Header -->
				<button
					class="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-tertiary transition-colors"
					onclick={() => toggleCategory(category)}
				>
					<Icon name={categoryIcons[category] || 'layers'} size={14} />
					<span class="flex-1 text-sm font-medium text-text-primary capitalize">{category}</span>
					<span class="text-xs text-text-tertiary">{categorySkills.length}</span>
					<Icon name={expandedCategory === category ? 'chevron-down' : 'chevron-right'} size={12} />
				</button>

				<!-- Skills in Category -->
				{#if expandedCategory === category}
					<div class="pb-2">
						{#each categorySkills as skill}
							{@const inPipeline = viewMode === 'all' && isInPipeline(skill.id)}
							<div
								class="skill-item mx-2 mb-1 p-2 bg-bg-primary border transition-colors {inPipeline ? 'border-green-500/50 bg-green-500/5' : 'border-surface-border hover:border-accent-primary cursor-grab'}"
								draggable={!inPipeline}
								ondragstart={(e) => !inPipeline && handleDragStart(e, skill)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm font-medium text-text-primary truncate">{skill.name}</span>
									<div class="flex items-center gap-1">
										{#if inPipeline}
											<span class="text-[10px] px-1.5 py-0.5 bg-green-500 bg-opacity-20 text-green-400 font-mono">
												IN PIPELINE
											</span>
										{/if}
										{#if skill.tier === 'premium'}
											<div class="flex items-center gap-0.5 text-accent-secondary">
												<Icon name="crown" size={10} />
											</div>
										{/if}
									</div>
								</div>
								<p class="text-xs text-text-tertiary line-clamp-1">{skill.description}</p>

								<!-- Quick Add Button -->
								{#if inPipeline}
									<div class="mt-2 w-full py-1 text-xs font-mono text-green-400 text-center border border-green-500 border-opacity-30 bg-green-500 bg-opacity-10 flex items-center justify-center gap-1">
										<Icon name="check" size={10} />
										Already Added
									</div>
								{:else}
									<button
										class="mt-2 w-full py-1 text-xs font-mono text-accent-primary border border-accent-primary border-opacity-30 hover:bg-accent-primary hover:text-bg-primary transition-colors"
										onclick={(e) => { e.stopPropagation(); handleAddToCanvas(skill); }}
									>
										+ Add to Canvas
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if viewMode === 'all' && !allSkillsLoaded}
			<div class="p-6 text-center">
				<div class="animate-spin w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full mx-auto mb-2"></div>
				<p class="text-text-tertiary text-sm">Loading skills...</p>
			</div>
		{:else if filteredSkills.length === 0}
			<div class="p-4 text-center text-text-tertiary text-sm">
				{#if viewMode === 'pipeline'}
					{#if searchQuery}
						No matching skills in pipeline
					{:else}
						<div class="space-y-2">
							<p>No skills in pipeline yet</p>
							<button
								class="text-accent-primary hover:underline"
								onclick={() => handleViewChange('all')}
							>
								Browse all skills to add some
							</button>
						</div>
					{/if}
				{:else}
					No skills found matching "{searchQuery}"
				{/if}
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="p-3 border-t border-surface-border bg-bg-tertiary">
		{#if viewMode === 'pipeline'}
			<button
				class="w-full flex items-center justify-center gap-1 text-xs text-accent-primary hover:underline"
				onclick={() => handleViewChange('all')}
			>
				<Icon name="grid" size={10} />
				<span>Browse all</span>
			</button>
		{:else}
			<a href="/skills" class="flex items-center justify-center gap-1 text-xs text-text-tertiary hover:text-text-secondary">
				<span>Open skills page</span>
				<Icon name="external-link" size={10} />
			</a>
		{/if}
	</div>
</div>

<style>
	.skill-item:active {
		cursor: grabbing;
	}

	.line-clamp-1 {
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
