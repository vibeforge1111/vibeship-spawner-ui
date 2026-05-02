<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import Icon from './Icon.svelte';
	import { filters, loadSkills, loading, skills, type Skill } from '$lib/stores/skills.svelte';

	let { variant = 'navbar' }: { variant?: 'navbar' | 'sidebar' } = $props();

	let open = $state(false);
	let query = $state('');
	let selectedIndex = $state(0);
	let inputEl: HTMLInputElement | undefined = $state();

	const normalizedQuery = $derived(query.trim().toLowerCase());
	const isSidebar = $derived(variant === 'sidebar');

	const results = $derived.by(() => {
		if (!normalizedQuery) return [];

		return $skills
			.map((skill) => ({ skill, score: scoreSkill(skill, normalizedQuery) }))
			.filter((result) => result.score > 0)
			.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
			.slice(0, 9)
			.map((result) => result.skill);
	});

	const groupedResults = $derived.by(() => {
		const groups = new Map<string, Skill[]>();
		for (const skill of results) {
			const label = formatCategory(skill.category);
			const group = groups.get(label) ?? [];
			group.push(skill);
			groups.set(label, group);
		}
		return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
	});

	onMount(() => {
		if ($skills.length === 0 && !$loading) {
			void loadSkills();
		}
	});

	function scoreSkill(skill: Skill, value: string) {
		const name = skill.name.toLowerCase();
		const id = skill.id.toLowerCase();
		const category = skill.category.toLowerCase();
		const description = skill.description.toLowerCase();
		const tags = skill.tags.map((tag) => tag.toLowerCase());

		if (name === value || id === value) return 100;
		if (name.startsWith(value) || id.startsWith(value)) return 85;
		if (name.includes(value) || id.includes(value)) return 70;
		if (tags.some((tag) => tag === value || tag.startsWith(value))) return 55;
		if (category.includes(value)) return 42;
		if (tags.some((tag) => tag.includes(value))) return 36;
		if (description.includes(value)) return 20;
		return 0;
	}

	function formatCategory(category: string) {
		return category
			.split(/[-_]/)
			.filter(Boolean)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	async function openPalette() {
		query = $filters.search || '';
		selectedIndex = 0;
		open = true;
		await tick();
		inputEl?.focus();
		inputEl?.select();
	}

	function closePalette() {
		open = false;
		query = '';
		selectedIndex = 0;
	}

	function clearQuery() {
		query = '';
		selectedIndex = 0;
		void tick().then(() => inputEl?.focus());
	}

	function selectSkill(skill: Skill) {
		closePalette();
		goto(`/skills/${encodeURIComponent(skill.id)}`);
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (isSidebar) return;

		const target = event.target as HTMLElement | null;
		const isTyping =
			target?.tagName === 'INPUT' ||
			target?.tagName === 'TEXTAREA' ||
			target?.isContentEditable;

		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
			event.preventDefault();
			void openPalette();
			return;
		}

		if (!open && event.key === '/' && !isTyping) {
			event.preventDefault();
			void openPalette();
			return;
		}

		if (!open) return;

		if (event.key === 'Escape') {
			event.preventDefault();
			closePalette();
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, Math.max(results.length - 1, 0));
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, 0);
		} else if (event.key === 'Enter' && results[selectedIndex]) {
			event.preventDefault();
			selectSkill(results[selectedIndex]);
		}
	}
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<button
	type="button"
	onclick={openPalette}
	class={isSidebar ? 'skill-search-trigger sidebar-trigger' : 'skill-search-trigger navbar-trigger'}
	aria-label="Search skills"
>
	<Icon name="search" size={isSidebar ? 15 : 14} class="search-trigger-icon" />
	<span class="search-trigger-label">
		{#if $filters.search}
			{$filters.search}
		{:else}
			Search skills...
		{/if}
	</span>
	<kbd class="search-trigger-key">/</kbd>
</button>

{#if open}
	<button type="button" class="search-overlay" aria-label="Close search" onclick={closePalette}></button>
	<div class="search-shell" role="dialog" aria-modal="true" aria-label="Search skills">
		<div class="search-modal">
			<div class="search-input-row">
				<Icon name="search" size={20} class="search-input-icon" />
				<input
					bind:this={inputEl}
					type="text"
					bind:value={query}
					oninput={() => (selectedIndex = 0)}
					placeholder="Search skills, tags, categories..."
					class="search-input"
				/>
				{#if query}
					<button type="button" onclick={clearQuery} class="search-clear" aria-label="Clear search">
						<Icon name="x" size={14} />
					</button>
				{/if}
				<kbd class="search-esc">esc</kbd>
			</div>

			{#if normalizedQuery}
				<div class="search-results">
					{#if results.length === 0}
						<div class="search-empty">
							<Icon name="search" size={18} />
							<p>No matching skills</p>
						</div>
					{:else}
						{#each groupedResults as group}
							<section>
								<p class="search-group-label">{group.label}</p>
								{#each group.items as skill}
									{@const flatIndex = results.findIndex((candidate) => candidate.id === skill.id)}
									<button
										type="button"
										class="search-result"
										class:selected={flatIndex === selectedIndex}
										onmouseenter={() => (selectedIndex = flatIndex)}
										onclick={() => selectSkill(skill)}
									>
										<span class="search-result-icon">
											<Icon name="layers" size={15} />
										</span>
										<span class="search-result-body">
											<span class="search-result-title">{skill.name}</span>
											<span class="search-result-desc">{skill.description || skill.id}</span>
										</span>
										<span class="search-result-meta">{skill.tier}</span>
										{#if flatIndex === selectedIndex}
											<kbd class="search-enter">enter</kbd>
										{/if}
									</button>
								{/each}
							</section>
						{/each}
					{/if}
				</div>
			{:else}
				<div class="search-hint">
					<p class="search-hint-title">Search the skill graph</p>
					<p>Find H70 skills by name, category, tag, or what they are used for.</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.skill-search-trigger {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: rgb(var(--bg-rgb) / 0.46);
		color: var(--text-tertiary);
		cursor: pointer;
		transition:
			border-color 220ms cubic-bezier(0.23, 1, 0.32, 1),
			background-color 220ms cubic-bezier(0.23, 1, 0.32, 1),
			color 220ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.skill-search-trigger:hover {
		color: var(--text);
		border-color: rgb(var(--accent-rgb) / 0.38);
		background: rgb(var(--bg-subtle-rgb) / 0.82);
		transform: translateY(-1px);
	}

	.skill-search-trigger:active {
		transform: translateY(0) scale(0.97);
		transition-duration: 100ms;
	}

	.navbar-trigger {
		height: 36px;
		gap: 8px;
		padding: 0 10px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 12px;
	}

	.sidebar-trigger {
		width: 100%;
		height: 38px;
		gap: 9px;
		padding: 0 12px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 13px;
		text-align: left;
	}

	:global(.search-trigger-icon) {
		flex: 0 0 auto;
		transition:
			color 240ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 240ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.skill-search-trigger:hover :global(.search-trigger-icon) {
		color: var(--accent);
		transform: scale(1.12) rotate(-12deg);
	}

	.search-trigger-label {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.search-trigger-key {
		margin-left: auto;
		border: 1px solid var(--border-strong);
		border-radius: 5px;
		background: rgb(var(--bg-rgb) / 0.58);
		padding: 2px 6px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		line-height: 1;
		color: rgb(var(--text-secondary-rgb) / 0.55);
	}

	.search-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		border: 0;
		background: rgb(0 0 0 / 0.52);
		backdrop-filter: blur(8px);
		animation: search-overlay-in 180ms ease-out both;
	}

	.search-shell {
		position: fixed;
		inset: 0;
		z-index: 81;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 14vh 16px 24px;
		pointer-events: none;
	}

	.search-modal {
		width: min(620px, 100%);
		overflow: hidden;
		border: 1px solid rgb(var(--accent-rgb) / 0.42);
		border-radius: 8px;
		background: var(--surface);
		box-shadow:
			0 0 0 3px rgb(var(--accent-rgb) / 0.08),
			0 24px 80px -30px rgb(0 0 0 / 0.92);
		pointer-events: auto;
		animation: search-modal-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.search-input-row {
		display: flex;
		align-items: center;
		gap: 16px;
		border-bottom: 1px solid var(--border);
		padding: 18px 22px;
	}

	:global(.search-input-icon) {
		flex: 0 0 auto;
		color: var(--accent);
	}

	.search-input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: var(--text);
		font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
		font-size: 18px;
		line-height: 1.35;
		outline: none;
		caret-color: var(--accent);
	}

	.search-input:focus,
	.search-input:focus-visible {
		outline: none;
		box-shadow: none;
	}

	.search-input::placeholder {
		color: rgb(var(--text-tertiary-rgb) / 0.45);
	}

	.search-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}

	.search-clear:hover {
		background: var(--bg-subtle);
		color: var(--text);
	}

	.search-esc,
	.search-enter {
		border: 1px solid var(--border-strong);
		border-radius: 5px;
		background: var(--bg-subtle);
		padding: 3px 6px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		line-height: 1;
		color: var(--text-tertiary);
	}

	.search-results {
		max-height: min(430px, 54vh);
		overflow-y: auto;
		padding: 8px 0;
	}

	.search-group-label {
		padding: 12px 20px 4px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: rgb(var(--text-tertiary-rgb) / 0.68);
	}

	.search-result {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 12px;
		border: 0;
		background: transparent;
		padding: 10px 20px;
		color: var(--text-secondary);
		cursor: pointer;
		transition:
			background-color 180ms ease,
			color 180ms ease;
	}

	.search-result:hover,
	.search-result.selected {
		background: rgb(var(--accent-rgb) / 0.065);
		color: var(--text);
	}

	.search-result-icon {
		display: inline-flex;
		width: 34px;
		height: 34px;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: var(--border);
		color: var(--text-tertiary);
		transition:
			background-color 180ms ease,
			color 180ms ease;
	}

	.search-result.selected .search-result-icon,
	.search-result:hover .search-result-icon {
		background: rgb(var(--accent-rgb) / 0.15);
		color: var(--accent);
	}

	.search-result-body {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 2px;
		text-align: left;
	}

	.search-result-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 14px;
		font-weight: 650;
		color: var(--text);
	}

	.search-result-desc {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11px;
		color: rgb(var(--text-tertiary-rgb) / 0.72);
	}

	.search-result-meta {
		flex: 0 0 auto;
		border: 1px solid rgb(var(--accent-rgb) / 0.25);
		border-radius: 5px;
		padding: 3px 6px;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 10px;
		text-transform: uppercase;
		color: var(--accent);
	}

	.search-hint,
	.search-empty {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 34px 24px;
		text-align: center;
		color: rgb(var(--text-tertiary-rgb) / 0.72);
	}

	.search-hint-title {
		color: var(--text);
		font-size: 14px;
		font-weight: 650;
	}

	@keyframes search-modal-in {
		0% {
			opacity: 0;
			transform: scale(0.95) translateY(-8px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes search-overlay-in {
		0% {
			opacity: 0;
		}
		100% {
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.search-shell {
			padding-top: 10vh;
		}

		.search-input-row {
			gap: 10px;
			padding: 15px;
		}

		.search-input {
			font-size: 16px;
		}

		.search-result {
			padding-inline: 14px;
		}

		.navbar-trigger .search-trigger-label,
		.navbar-trigger .search-trigger-key {
			display: none;
		}

		.navbar-trigger {
			width: 36px;
			justify-content: center;
			padding: 0;
		}
	}
</style>
