<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';
	import { loadSkills, type Skill } from '$lib/stores/skills.svelte';
	import { addNode, nodes, type CanvasNode } from '$lib/stores/canvas.svelte';

	let searchQuery = $state('');
	let expandedCategory = $state<string | null>(null);
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
		loadAllSkills();
	});

	// Load the full catalog from /skills.json
	async function loadAllSkills() {
		if (allSkillsLoaded) return;

		try {
			const response = await fetch('/skills.json');
			if (response.ok) {
				const data = await response.json();
				// Define raw skill interface for type safety
				interface RawSkill {
					id: string;
					name: string;
					description?: string;
					category?: string;
					tier?: string;
					tags?: string[];
					triggers?: string[];
					handoffs?: { trigger: string; to: string }[];
					pairsWell?: string[];
				}
				allSkillsList = (data as RawSkill[]).map((s) => ({
					id: s.id,
					name: s.name,
					description: s.description || '',
					category: s.category || 'development',
					tier: s.tier || 'free',
					tags: s.tags || [],
					triggers: s.triggers || [],
					handoffs: s.handoffs || [],
					pairsWell: s.pairsWell || []
				})) as Skill[];
				allSkillsLoaded = true;
			}
		} catch (e) {
			console.error('[SkillsPanel] Failed to load all skills:', e);
		}
	}

	// Pipeline skills (on canvas) and their ids for "in pipeline" highlighting
	const pipelineSkills = $derived(currentNodes.map((node) => node.skill));
	const pipelineSkillIds = $derived(new Set(currentNodes.map((node) => node.skill.id)));

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

	const filteredSkills = $derived(
		allSkillsList.filter(
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
	<!-- Header — catalog size + in-pipeline count -->
	<div class="flex items-center justify-between px-3 py-2.5 border-b border-surface-border">
		<span class="overline" style="margin-bottom: 0;">Skills</span>
		<div class="flex items-center gap-1.5 font-mono text-[10px]">
			<span class="text-text-tertiary">{allSkillsList.length} total</span>
			{#if pipelineSkills.length > 0}
				<span class="text-text-faint">·</span>
				<span class="px-1.5 py-0.5 rounded-sm bg-accent-subtle text-accent-primary border border-accent-mid">
					{pipelineSkills.length} in pipeline
				</span>
			{/if}
		</div>
	</div>

	<!-- Search -->
	<div class="p-3 border-b border-surface-border">
		<div class="relative">
			<div class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary">
				<Icon name="search" size={14} />
			</div>
			<input
				type="text"
				placeholder="Search skills..."
				bind:value={searchQuery}
				class="w-full pl-8 pr-3 py-2 bg-bg-primary border border-surface-border rounded-md text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
			/>
		</div>
	</div>

	{#if pipelineSkills.length > 0 && !searchQuery}
		<!-- Pinned: skills currently on canvas -->
		<div class="border-b border-surface-border bg-bg-primary/40">
			<div class="px-3 py-2 flex items-center gap-2">
				<span class="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse"></span>
				<span class="overline" style="margin-bottom: 0;">In pipeline</span>
			</div>
			<div class="px-2 pb-2 flex flex-wrap gap-1">
				{#each pipelineSkills as skill (skill.id)}
					<span class="px-2 py-0.5 text-[11px] font-mono bg-accent-subtle text-accent-primary border border-accent-mid rounded-sm truncate max-w-[180px]" title={skill.name}>
						{skill.name}
					</span>
				{/each}
			</div>
		</div>
	{/if}

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
							{@const inPipeline = isInPipeline(skill.id)}
							<div
								class="skill-item mx-2 mb-1 p-2 bg-bg-primary border rounded-md transition-colors {inPipeline ? 'border-accent-mid bg-accent-subtle' : 'border-surface-border hover:border-accent-primary cursor-grab'}"
								draggable={!inPipeline}
								ondragstart={(e) => !inPipeline && handleDragStart(e, skill)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm font-medium text-text-primary truncate">{skill.name}</span>
									<div class="flex items-center gap-1">
										{#if inPipeline}
											<span class="text-[10px] px-1.5 py-0.5 rounded-sm bg-accent-subtle text-accent-primary border border-accent-mid font-mono">
												in pipeline
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
									<div class="mt-2 w-full py-1 text-xs font-mono text-accent-primary text-center border border-accent-mid bg-accent-subtle rounded-sm flex items-center justify-center gap-1">
										<Icon name="check" size={10} />
										on canvas
									</div>
								{:else}
									<button
										class="mt-2 w-full py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 rounded-sm hover:bg-accent-primary hover:text-bg-primary transition-colors"
										onclick={(e) => { e.stopPropagation(); handleAddToCanvas(skill); }}
									>
										+ Add to canvas
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if !allSkillsLoaded}
			<div class="p-6 text-center">
				<div class="animate-spin w-5 h-5 border-2 border-accent-primary/30 border-t-accent-primary rounded-full mx-auto mb-2"></div>
				<p class="text-text-tertiary text-sm">Loading skills...</p>
			</div>
		{:else if filteredSkills.length === 0}
			<div class="p-4 text-center text-text-tertiary text-sm">
				{searchQuery ? `No skills match "${searchQuery}"` : 'No skills available'}
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="p-3 border-t border-surface-border bg-bg-tertiary">
		<a href="/skills" class="flex items-center justify-center gap-1 text-xs text-text-tertiary hover:text-text-secondary">
			<span>Open skills page</span>
			<Icon name="external-link" size={10} />
		</a>
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
