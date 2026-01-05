<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Icon from './Icon.svelte';
	import { skills, loadSkills, type Skill } from '$lib/stores/skills.svelte';
	import { addNode } from '$lib/stores/canvas.svelte';

	let searchQuery = $state('');
	let expandedCategory = $state<string | null>(null);
	let skillsList = $state<Skill[]>([]);
	let isLoading = $state(true);

	onMount(async () => {
		await loadSkills();

		// Get skills directly from store after load
		const loadedSkills = get(skills);
		skillsList = loadedSkills;
		isLoading = false;

		// Also subscribe for future updates
		const unsub = skills.subscribe((s) => {
			skillsList = s;
		});

		return unsub;
	});

	// Extended category icons to cover all categories in skills.json
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

	const filteredSkills = $derived.by(() => {
		return skillsList.filter(
			(skill) =>
				skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				skill.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
		);
	});

	const groupedSkills = $derived.by(() => {
		const groups: Record<string, Skill[]> = {};
		for (const skill of filteredSkills) {
			if (!groups[skill.category]) {
				groups[skill.category] = [];
			}
			groups[skill.category].push(skill);
		}
		return groups;
	});

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
				class="w-full pl-8 pr-3 py-2 bg-bg-primary border border-surface-border text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
			/>
		</div>
	</div>

	<!-- Skills List -->
	<div class="flex-1 overflow-y-auto">
		{#if isLoading}
			<div class="p-4 text-center text-text-tertiary text-sm">
				<div class="animate-pulse">Loading skills...</div>
			</div>
		{:else if Object.keys(groupedSkills).length === 0 && searchQuery === ''}
			<div class="p-4 text-center text-text-tertiary text-sm">
				<div class="mb-2">No skills loaded</div>
				<button
					class="text-xs text-accent-primary hover:underline"
					onclick={() => { isLoading = true; loadSkills().then(() => { skillsList = get(skills); isLoading = false; }); }}
				>
					Retry loading
				</button>
			</div>
		{/if}
		{#each Object.entries(groupedSkills) as [category, categorySkills]}
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
							<div
								class="skill-item mx-2 mb-1 p-2 bg-bg-primary border border-surface-border hover:border-accent-primary cursor-grab transition-colors"
								draggable="true"
								ondragstart={(e) => handleDragStart(e, skill)}
								role="button"
								tabindex="0"
							>
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm font-medium text-text-primary truncate">{skill.name}</span>
									{#if skill.tier === 'premium'}
										<div class="flex items-center gap-0.5 text-accent-secondary">
											<Icon name="crown" size={10} />
										</div>
									{/if}
								</div>
								<p class="text-xs text-text-tertiary line-clamp-1">{skill.description}</p>

								<!-- Quick Add Button -->
								<button
									class="mt-2 w-full py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 hover:bg-accent-primary hover:text-bg-primary transition-colors"
									onclick={(e) => { e.stopPropagation(); handleAddToCanvas(skill); }}
								>
									+ Add to Canvas
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}

		{#if filteredSkills.length === 0}
			<div class="p-4 text-center text-text-tertiary text-sm">
				No skills found
			</div>
		{/if}
	</div>

	<!-- Footer -->
	<div class="p-3 border-t border-surface-border bg-bg-tertiary">
		<a href="/skills" class="flex items-center justify-center gap-1 text-xs text-accent-primary hover:underline">
			<span>Browse all skills</span>
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
