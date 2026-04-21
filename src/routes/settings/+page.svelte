<script lang="ts">
	import { browser } from '$app/environment';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { pipelines } from '$lib/stores/pipelines.svelte';
	import { getGeneratedSkillsCount, clearGeneratedSkills } from '$lib/stores/skills.svelte';

	let pipelineCount = $state(0);
	let generatedSkillsCount = $state(0);
	let localStorageSize = $state('0 KB');

	function calculateLocalStorageSize(): string {
		if (!browser) return '0 KB';
		let total = 0;
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith('spawner-')) {
				total += (localStorage.getItem(key)?.length || 0) * 2;
			}
		}
		if (total < 1024) return `${total} B`;
		if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
		return `${(total / (1024 * 1024)).toFixed(2)} MB`;
	}

	function refreshStorageStats() {
		if (!browser) return;
		generatedSkillsCount = getGeneratedSkillsCount();
		localStorageSize = calculateLocalStorageSize();
	}

	function handleClearGeneratedSkills() {
		if (!confirm('Clear all generated skills? This cannot be undone.')) return;
		clearGeneratedSkills();
		refreshStorageStats();
	}

	function handleClearAllData() {
		if (!confirm('Clear ALL Spawner data from localStorage? This includes pipelines, skills, and settings. This cannot be undone.')) {
			return;
		}

		if (!browser) return;
		const keysToDelete = Object.keys(localStorage).filter((key) => key.startsWith('spawner-'));
		for (const key of keysToDelete) {
			localStorage.removeItem(key);
		}
		window.location.reload();
	}

	$effect(() => {
		const unsubscribe = pipelines.subscribe((items) => {
			pipelineCount = items.length;
		});
		refreshStorageStats();
		return () => unsubscribe();
	});
</script>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
		<div class="mb-8">
			<h1 class="text-3xl font-serif text-text-primary mb-2">Settings</h1>
			<p class="text-text-secondary">Spawner keeps runtime data local. Provider setup and mission options live in the execution flow.</p>
		</div>

		<section class="mb-12">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h2 class="text-xl font-medium text-text-primary flex items-center gap-2">
						Local Data
						<span class="text-sm font-mono text-accent-secondary">localStorage</span>
					</h2>
					<p class="text-sm text-text-secondary mt-1">
						Canvas state, generated skills, and UI defaults are stored in your browser.
					</p>
				</div>
				<span class="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10">
					{localStorageSize}
				</span>
			</div>

			<div class="border border-surface-border bg-bg-secondary">
				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/30">
							<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
							</svg>
						</div>
						<div>
							<span class="font-medium text-text-primary">Pipelines</span>
							<p class="text-sm text-text-secondary">Saved canvas workflows</p>
						</div>
					</div>
					<span class="text-lg font-mono text-text-primary">{pipelineCount}</span>
				</div>

				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 flex items-center justify-center bg-purple-500/10 border border-purple-500/30">
							<svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
							</svg>
						</div>
						<div>
							<span class="font-medium text-text-primary">Generated Skills</span>
							<p class="text-sm text-text-secondary">Skills created from PRD analysis</p>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<span class="text-lg font-mono text-text-primary">{generatedSkillsCount}</span>
						{#if generatedSkillsCount > 0}
							<button
								onclick={handleClearGeneratedSkills}
								class="text-xs text-text-tertiary hover:text-red-400 transition-colors"
							>
								Clear
							</button>
						{/if}
					</div>
				</div>

				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 flex items-center justify-center bg-green-500/10 border border-green-500/30">
							<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
							</svg>
						</div>
						<div>
							<span class="font-medium text-text-primary">Preferences</span>
							<p class="text-sm text-text-secondary">Canvas and execution defaults</p>
						</div>
					</div>
					<span class="text-sm font-mono text-green-400">Auto-saved</span>
				</div>

				<div class="p-4">
					<div class="flex items-center justify-between">
						<p class="text-sm text-text-secondary">
							All local data uses <code class="px-1 py-0.5 bg-bg-primary border border-surface-border text-xs">spawner-*</code> keys.
						</p>
						<div class="flex items-center gap-2">
							<button
								onclick={refreshStorageStats}
								class="px-3 py-1.5 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary transition-all"
							>
								Refresh
							</button>
							<button
								onclick={handleClearAllData}
								class="px-3 py-1.5 text-sm font-mono text-red-400/70 border border-red-500/30 hover:border-red-500 hover:text-red-400 transition-all"
							>
								Clear All Data
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	</main>

	<Footer />
</div>
