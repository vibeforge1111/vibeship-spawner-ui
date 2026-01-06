<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import {
		memorySettingsState,
		memorySettings,
		isMemoryConnected,
		isMemoryConnecting,
		memoryBackend,
		memoryVersion,
		memoryError,
		updateMemorySettings,
		connectMemory,
		disconnectMemory,
		testMemoryConnection,
		resetMemorySettings
	} from '$lib/stores/memory-settings.svelte';
	import { pipelines } from '$lib/stores/pipelines.svelte';
	import { getGeneratedSkillsCount, clearGeneratedSkills } from '$lib/stores/skills.svelte';
	import type { MemorySettings, LearningGranularity } from '$lib/types/memory';

	let currentSettings = $state<MemorySettings>({
		enabled: true,
		backend: 'auto',
		liteEndpoint: 'http://localhost:8080',
		standardEndpoint: 'http://localhost:8080',
		userId: '550e8400-e29b-41d4-a716-446655440000',
		learningGranularity: 'significant',
		autoExtractPatterns: true,
		syncLearnings: true
	});

	let isConnected = $state(false);
	let isConnecting = $state(false);
	let backend = $state<string | null>(null);
	let version = $state<string | null>(null);
	let error = $state<string | null>(null);

	let testResult = $state<{ success: boolean; message: string } | null>(null);
	let testing = $state(false);

	// Local storage stats
	let pipelineCount = $state(0);
	let generatedSkillsCount = $state(0);
	let localStorageSize = $state('0 KB');

	// Calculate localStorage usage
	function calculateLocalStorageSize(): string {
		if (!browser) return '0 KB';
		let total = 0;
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith('spawner-')) {
				total += (localStorage.getItem(key)?.length || 0) * 2; // UTF-16 = 2 bytes per char
			}
		}
		if (total < 1024) return `${total} B`;
		if (total < 1024 * 1024) return `${(total / 1024).toFixed(1)} KB`;
		return `${(total / (1024 * 1024)).toFixed(2)} MB`;
	}

	function refreshStorageStats() {
		if (browser) {
			generatedSkillsCount = getGeneratedSkillsCount();
			localStorageSize = calculateLocalStorageSize();
		}
	}

	function handleClearGeneratedSkills() {
		if (confirm('Clear all generated skills? This cannot be undone.')) {
			clearGeneratedSkills();
			refreshStorageStats();
		}
	}

	function handleClearAllData() {
		if (confirm('Clear ALL Spawner data from localStorage? This includes pipelines, skills, and settings. This cannot be undone.')) {
			if (browser) {
				const keysToDelete = Object.keys(localStorage).filter(k => k.startsWith('spawner-'));
				for (const key of keysToDelete) {
					localStorage.removeItem(key);
				}
				window.location.reload();
			}
		}
	}

	$effect(() => {
		const unsub1 = memorySettings.subscribe((s) => (currentSettings = s));
		const unsub2 = isMemoryConnected.subscribe((v) => (isConnected = v));
		const unsub3 = isMemoryConnecting.subscribe((v) => (isConnecting = v));
		const unsub4 = memoryBackend.subscribe((v) => (backend = v));
		const unsub5 = memoryVersion.subscribe((v) => (version = v));
		const unsub6 = memoryError.subscribe((v) => (error = v));
		const unsub7 = pipelines.subscribe((p) => (pipelineCount = p.length));

		// Initial storage stats calculation
		refreshStorageStats();

		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
			unsub5();
			unsub6();
			unsub7();
		};
	});

	async function handleConnect() {
		testResult = null;
		await connectMemory();
	}

	function handleDisconnect() {
		disconnectMemory();
	}

	async function handleTestConnection() {
		testing = true;
		testResult = null;

		const result = await testMemoryConnection();

		if (result.success) {
			testResult = {
				success: true,
				message: `Connected to ${result.backend} tier (v${result.version})`
			};
		} else {
			testResult = {
				success: false,
				message: result.error ?? 'Connection failed'
			};
		}

		testing = false;
	}

	function handleReset() {
		if (confirm('Reset all Mind settings to defaults?')) {
			resetMemorySettings();
			testResult = null;
		}
	}

	function updateSetting<K extends keyof MemorySettings>(key: K, value: MemorySettings[K]) {
		updateMemorySettings({ [key]: value });
	}
</script>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />

	<main class="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
		<!-- Header -->
		<div class="mb-8">
			<div class="flex items-center gap-3 mb-2">
				<h1 class="text-3xl font-serif text-text-primary">Settings</h1>
			</div>
			<p class="text-text-secondary">Configure Spawner UI integrations and preferences.</p>
		</div>

		<!-- Mind Integration Section -->
		<section class="mb-12">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h2 class="text-xl font-medium text-text-primary flex items-center gap-2">
						Mind Integration
						<span class="text-sm font-mono text-accent-secondary">v5</span>
					</h2>
					<p class="text-sm text-text-secondary mt-1">
						Connect to Mind for agent learning and memory persistence.
					</p>
				</div>

				<!-- Connection Status Badge -->
				<div class="flex items-center gap-2">
					{#if isConnected}
						<span
							class="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-green-400 border border-green-500/30 bg-green-500/10"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
							{backend ?? 'Unknown'} tier
							{#if version}
								<span class="text-green-400/60">v{version}</span>
							{/if}
						</span>
					{:else if isConnecting}
						<span
							class="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-yellow-400 border border-yellow-500/30 bg-yellow-500/10"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
							Connecting...
						</span>
					{:else}
						<span
							class="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-text-tertiary border border-surface-border"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
							Disconnected
						</span>
					{/if}
				</div>
			</div>

			{#if error}
				<div class="mb-6 p-3 border border-red-500/30 bg-red-500/10 text-sm text-red-400 font-mono">
					{error}
				</div>
			{/if}

			<div class="border border-surface-border bg-bg-secondary">
				<!-- Enable/Disable Toggle -->
				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div>
						<label for="memory-enabled" class="font-medium text-text-primary">
							Enable Mind Integration
						</label>
						<p class="text-sm text-text-secondary mt-0.5">
							Record agent decisions and learnings to Mind.
						</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							id="memory-enabled"
							type="checkbox"
							checked={currentSettings.enabled}
							onchange={(e) => updateSetting('enabled', e.currentTarget.checked)}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"
						></div>
					</label>
				</div>

				<!-- Backend Selection -->
				<div class="p-4 border-b border-surface-border">
					<span class="block font-medium text-text-primary mb-2" id="backend-label">Backend</span>
					<p class="text-sm text-text-secondary mb-3">
						Choose which Mind backend to connect to.
					</p>
					<div class="flex gap-2">
						<button
							onclick={() => updateSetting('backend', 'auto')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.backend === 'auto'}
							class:text-bg-primary={currentSettings.backend === 'auto'}
							class:border-accent-primary={currentSettings.backend === 'auto'}
							class:text-text-secondary={currentSettings.backend !== 'auto'}
							class:border-surface-border={currentSettings.backend !== 'auto'}
						>
							Auto-detect
						</button>
						<button
							onclick={() => updateSetting('backend', 'lite')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.backend === 'lite'}
							class:text-bg-primary={currentSettings.backend === 'lite'}
							class:border-accent-primary={currentSettings.backend === 'lite'}
							class:text-text-secondary={currentSettings.backend !== 'lite'}
							class:border-surface-border={currentSettings.backend !== 'lite'}
						>
							Lite (SQLite)
						</button>
						<button
							onclick={() => updateSetting('backend', 'standard')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.backend === 'standard'}
							class:text-bg-primary={currentSettings.backend === 'standard'}
							class:border-accent-primary={currentSettings.backend === 'standard'}
							class:text-text-secondary={currentSettings.backend !== 'standard'}
							class:border-surface-border={currentSettings.backend !== 'standard'}
						>
							Standard (PostgreSQL)
						</button>
					</div>
				</div>

				<!-- Endpoint Configuration -->
				<div class="p-4 border-b border-surface-border">
					<label for="lite-endpoint" class="block font-medium text-text-primary mb-2">
						Lite Tier Endpoint
					</label>
					<input
						id="lite-endpoint"
						type="text"
						value={currentSettings.liteEndpoint}
						oninput={(e) => updateSetting('liteEndpoint', e.currentTarget.value)}
						placeholder="http://localhost:8080"
						class="w-full px-3 py-2 bg-bg-primary border border-surface-border text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
					/>
				</div>

				<!-- Learning Granularity -->
				<div class="p-4 border-b border-surface-border">
					<span class="block font-medium text-text-primary mb-2" id="granularity-label">Learning Granularity</span>
					<p class="text-sm text-text-secondary mb-3">
						How much agent activity to record.
					</p>
					<div class="flex flex-wrap gap-2">
						<button
							onclick={() => updateSetting('learningGranularity', 'everything')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.learningGranularity === 'everything'}
							class:text-bg-primary={currentSettings.learningGranularity === 'everything'}
							class:border-accent-primary={currentSettings.learningGranularity === 'everything'}
							class:text-text-secondary={currentSettings.learningGranularity !== 'everything'}
							class:border-surface-border={currentSettings.learningGranularity !== 'everything'}
						>
							Everything
						</button>
						<button
							onclick={() => updateSetting('learningGranularity', 'almost-everything')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.learningGranularity === 'almost-everything'}
							class:text-bg-primary={currentSettings.learningGranularity === 'almost-everything'}
							class:border-accent-primary={currentSettings.learningGranularity === 'almost-everything'}
							class:text-text-secondary={currentSettings.learningGranularity !== 'almost-everything'}
							class:border-surface-border={currentSettings.learningGranularity !== 'almost-everything'}
						>
							Almost All
						</button>
						<button
							onclick={() => updateSetting('learningGranularity', 'moderate')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.learningGranularity === 'moderate'}
							class:text-bg-primary={currentSettings.learningGranularity === 'moderate'}
							class:border-accent-primary={currentSettings.learningGranularity === 'moderate'}
							class:text-text-secondary={currentSettings.learningGranularity !== 'moderate'}
							class:border-surface-border={currentSettings.learningGranularity !== 'moderate'}
						>
							Moderate
						</button>
						<button
							onclick={() => updateSetting('learningGranularity', 'significant')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.learningGranularity === 'significant'}
							class:text-bg-primary={currentSettings.learningGranularity === 'significant'}
							class:border-accent-primary={currentSettings.learningGranularity === 'significant'}
							class:text-text-secondary={currentSettings.learningGranularity !== 'significant'}
							class:border-surface-border={currentSettings.learningGranularity !== 'significant'}
						>
							Significant
						</button>
						<button
							onclick={() => updateSetting('learningGranularity', 'manual')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.learningGranularity === 'manual'}
							class:text-bg-primary={currentSettings.learningGranularity === 'manual'}
							class:border-accent-primary={currentSettings.learningGranularity === 'manual'}
							class:text-text-secondary={currentSettings.learningGranularity !== 'manual'}
							class:border-surface-border={currentSettings.learningGranularity !== 'manual'}
						>
							Manual
						</button>
					</div>
					<p class="text-xs text-text-tertiary mt-2">
						{#if currentSettings.learningGranularity === 'everything'}
							Record all decisions and outcomes. No filtering.
						{:else if currentSettings.learningGranularity === 'almost-everything'}
							Skip only very low-confidence decisions (25%+).
						{:else if currentSettings.learningGranularity === 'moderate'}
							Record medium-confidence decisions (50%+). Good balance.
						{:else if currentSettings.learningGranularity === 'significant'}
							Only high-confidence decisions (70%+). Recommended.
						{:else}
							User must explicitly mark what to record. Most control.
						{/if}
					</p>
				</div>

				<!-- Auto-extract Patterns -->
				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div>
						<label for="auto-patterns" class="font-medium text-text-primary">
							Auto-extract Patterns
						</label>
						<p class="text-sm text-text-secondary mt-0.5">
							Automatically identify successful workflow patterns.
						</p>
					</div>
					<label class="relative inline-flex items-center cursor-pointer">
						<input
							id="auto-patterns"
							type="checkbox"
							checked={currentSettings.autoExtractPatterns}
							onchange={(e) => updateSetting('autoExtractPatterns', e.currentTarget.checked)}
							class="sr-only peer"
						/>
						<div
							class="w-11 h-6 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"
						></div>
					</label>
				</div>

				<!-- Connection Actions -->
				<div class="p-4 flex items-center justify-between">
					<div class="flex items-center gap-2">
						{#if isConnected}
							<button
								onclick={handleDisconnect}
								class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-red-500/50 hover:text-red-400 transition-all"
							>
								Disconnect
							</button>
						{:else}
							<button
								onclick={handleConnect}
								disabled={isConnecting || !currentSettings.enabled}
								class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isConnecting ? 'Connecting...' : 'Connect'}
							</button>
						{/if}

						<button
							onclick={handleTestConnection}
							disabled={testing || !currentSettings.enabled}
							class="px-4 py-2 text-sm font-mono text-text-secondary border border-surface-border hover:border-text-tertiary hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{testing ? 'Testing...' : 'Test Connection'}
						</button>
					</div>

					<button
						onclick={handleReset}
						class="px-4 py-2 text-sm font-mono text-text-tertiary hover:text-red-400 transition-all"
					>
						Reset to Defaults
					</button>
				</div>

				{#if testResult}
					<div
						class="mx-4 mb-4 p-3 text-sm font-mono border {testResult.success
							? 'border-green-500/30 bg-green-500/10 text-green-400'
							: 'border-red-500/30 bg-red-500/10 text-red-400'}"
					>
						{testResult.message}
					</div>
				{/if}
			</div>
		</section>

		<!-- Local Data Persistence Section -->
		<section class="mb-12">
			<div class="flex items-center justify-between mb-6">
				<div>
					<h2 class="text-xl font-medium text-text-primary flex items-center gap-2">
						Local Data Persistence
						<span class="text-sm font-mono text-accent-secondary">localStorage</span>
					</h2>
					<p class="text-sm text-text-secondary mt-1">
						All your data is stored locally in your browser and persists across restarts.
					</p>
				</div>

				<!-- Storage Size Badge -->
				<span class="flex items-center gap-1.5 px-2 py-1 text-xs font-mono text-accent-primary border border-accent-primary/30 bg-accent-primary/10">
					{localStorageSize}
				</span>
			</div>

			<div class="border border-surface-border bg-bg-secondary">
				<!-- Pipelines -->
				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/30">
							<svg class="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
							</svg>
						</div>
						<div>
							<span class="font-medium text-text-primary">Pipelines</span>
							<p class="text-sm text-text-secondary">Your saved canvas workflows</p>
						</div>
					</div>
					<span class="text-lg font-mono text-text-primary">{pipelineCount}</span>
				</div>

				<!-- Generated Skills -->
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

				<!-- Memory Settings -->
				<div class="p-4 flex items-center justify-between border-b border-surface-border">
					<div class="flex items-center gap-3">
						<div class="w-10 h-10 flex items-center justify-center bg-green-500/10 border border-green-500/30">
							<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
							</svg>
						</div>
						<div>
							<span class="font-medium text-text-primary">Settings & Preferences</span>
							<p class="text-sm text-text-secondary">Mind settings, MCP URL, etc.</p>
						</div>
					</div>
					<span class="text-sm font-mono text-green-400">Auto-saved</span>
				</div>

				<!-- Data Actions -->
				<div class="p-4">
					<div class="flex items-center justify-between">
						<p class="text-sm text-text-secondary">
							All data stored with <code class="px-1 py-0.5 bg-bg-primary border border-surface-border text-xs">spawner-*</code> keys
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

		<!-- Quick Start Guide -->
		<section class="mb-12">
			<h2 class="text-xl font-medium text-text-primary mb-4">Quick Start</h2>
			<div class="border border-surface-border bg-bg-secondary p-6">
				<h3 class="font-medium text-text-primary mb-3">Start Mind v5 Lite Tier</h3>
				<p class="text-sm text-text-secondary mb-4">
					The Lite tier runs locally with zero configuration. Just start the API:
				</p>
				<div class="bg-bg-primary p-4 font-mono text-sm text-text-primary border border-surface-border mb-4">
					<code>cd the-mind/vibeship-mind</code><br />
					<code>python src/mind/lite_tier.py</code>
				</div>
				<p class="text-sm text-text-tertiary">
					Or use <code class="px-1 py-0.5 bg-bg-primary border border-surface-border">start_mind_lite.bat</code> for one-click startup.
				</p>
			</div>
		</section>
	</main>

	<Footer />
</div>
