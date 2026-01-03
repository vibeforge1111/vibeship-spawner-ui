<script lang="ts">
	import Icon from './Icon.svelte';

	let skillsDropdownOpen = $state(false);

	function toggleSkillsDropdown() {
		skillsDropdownOpen = !skillsDropdownOpen;
	}

	function closeDropdown() {
		skillsDropdownOpen = false;
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
		<!-- Logo -->
		<a href="/" class="flex items-center gap-1.5">
			<img src="/logo.png" alt="vibeship" class="w-6 h-6 -ml-0.5" />
			<span class="font-serif text-[1.36rem] text-text-primary" style="font-family: 'Instrument Serif', Georgia, serif;">vibeship</span>
			<span class="font-serif text-[1.36rem] text-accent-primary" style="font-family: 'Instrument Serif', Georgia, serif;">spawner</span>
		</a>

		<!-- Right side -->
		<div class="flex items-center gap-2">
			<!-- Guide link -->
			<a
				href="/guide"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-sm text-text-secondary border border-transparent hover:text-text-primary hover:border-surface-border transition-all"
			>
				<Icon name="book" size={14} />
				<span class="hidden sm:inline">Guide</span>
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
