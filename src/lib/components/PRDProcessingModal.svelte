<script lang="ts">
	// PRD Processing Modal - shows progress as PRD is analyzed
	let {
		isOpen = false,
		currentStage = 0,
		projectName = 'Your Project',
		featuresFound = 0,
		tasksGenerated = 0,
		onComplete
	}: {
		isOpen: boolean;
		currentStage: number;
		projectName?: string;
		featuresFound?: number;
		tasksGenerated?: number;
		onComplete?: () => void;
	} = $props();

	const stages = [
		{ label: 'Reading PRD', icon: '◈', description: 'Parsing your requirements document...' },
		{ label: 'Analyzing Features', icon: '◧', description: 'Extracting features and requirements...' },
		{ label: 'Detecting Stack', icon: '⬡', description: 'Identifying technology hints...' },
		{ label: 'Matching Skills', icon: '⚙', description: 'Finding specialized agents...' },
		{ label: 'Building Pipeline', icon: '◉', description: 'Creating workflow connections...' },
		{ label: 'Ready', icon: '✓', description: 'Pipeline generated successfully!' }
	];

	function getStageClasses(i: number): string {
		if (currentStage === i) {
			return 'bg-accent-primary/10 border border-accent-primary/30';
		} else if (currentStage < i) {
			return 'opacity-40';
		}
		return '';
	}

	function getIconClasses(i: number): string {
		if (currentStage > i) {
			return 'border-accent-primary bg-accent-primary text-bg-primary';
		} else if (currentStage >= i) {
			return 'border-accent-primary text-accent-primary';
		}
		return 'border-surface-border text-text-tertiary';
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
		<div class="bg-bg-secondary border border-surface-border max-w-md w-full overflow-hidden">
			<!-- Header -->
			<div class="px-6 py-4 border-b border-surface-border">
				<p class="font-mono text-xs text-accent-primary tracking-widest mb-1">PRD → PIPELINE</p>
				<h2 class="font-serif text-xl text-text-primary">Generating Workflow</h2>
			</div>

			<!-- Progress stages -->
			<div class="px-6 py-6">
				<div class="space-y-3">
					{#each stages as stage, i}
						<div class="flex items-center gap-4 p-3 rounded transition-all duration-300 {getStageClasses(i)}">
							<div class="w-8 h-8 flex items-center justify-center border transition-all duration-300 {getIconClasses(i)}">
								{#if currentStage > i}
									<span>✓</span>
								{:else}
									<span class="text-sm">{stage.icon}</span>
								{/if}
							</div>
							<div class="flex-1">
								<p class="text-sm font-medium {currentStage >= i ? 'text-text-primary' : 'text-text-tertiary'}">
									{stage.label}
								</p>
								{#if currentStage === i}
									<p class="text-xs text-text-tertiary mt-0.5 animate-pulse">
										{stage.description}
									</p>
								{/if}
							</div>
							{#if currentStage === i && i < stages.length - 1}
								<div class="w-4 h-4 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
							{/if}
						</div>
					{/each}
				</div>

				<!-- Stats (shown during/after processing) -->
				{#if currentStage >= 2}
					<div class="mt-6 pt-6 border-t border-surface-border">
						<div class="grid grid-cols-3 gap-4 text-center">
							<div>
								<p class="text-2xl font-bold text-accent-primary">{featuresFound}</p>
								<p class="text-xs text-text-tertiary font-mono">Features</p>
							</div>
							<div>
								<p class="text-2xl font-bold text-accent-secondary">{tasksGenerated}</p>
								<p class="text-xs text-text-tertiary font-mono">Tasks</p>
							</div>
							<div>
								<p class="text-2xl font-bold text-text-primary">{tasksGenerated > 0 ? tasksGenerated - 1 : 0}</p>
								<p class="text-xs text-text-tertiary font-mono">Connections</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Project name -->
				{#if projectName && projectName !== 'New Project'}
					<div class="mt-4 p-3 bg-surface rounded border border-surface-border">
						<p class="text-xs text-text-tertiary font-mono mb-1">PROJECT</p>
						<p class="text-sm text-text-primary font-medium">{projectName}</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if currentStage === stages.length - 1}
				<div class="px-6 py-4 border-t border-surface-border">
					<button
						onclick={onComplete}
						class="w-full py-3 bg-accent-primary text-bg-primary font-medium hover:bg-accent-primary/90 transition-colors flex items-center justify-center gap-2"
					>
						<span>View Pipeline</span>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
						</svg>
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
