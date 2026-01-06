<script lang="ts">
	import { onMount } from 'svelte';
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

	$effect(() => {
		const unsub1 = memorySettings.subscribe((s) => (currentSettings = s));
		const unsub2 = isMemoryConnected.subscribe((v) => (isConnected = v));
		const unsub3 = isMemoryConnecting.subscribe((v) => (isConnecting = v));
		const unsub4 = memoryBackend.subscribe((v) => (backend = v));
		const unsub5 = memoryVersion.subscribe((v) => (version = v));
		const unsub6 = memoryError.subscribe((v) => (error = v));
		return () => {
			unsub1();
			unsub2();
			unsub3();
			unsub4();
			unsub5();
			unsub6();
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
					<label class="block font-medium text-text-primary mb-2">Backend</label>
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
					<label class="block font-medium text-text-primary mb-2">Learning Granularity</label>
					<p class="text-sm text-text-secondary mb-3">
						How much agent activity to record.
					</p>
					<div class="flex gap-2">
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
							onclick={() => updateSetting('learningGranularity', 'significant')}
							class="px-3 py-1.5 text-sm font-mono border transition-all"
							class:bg-accent-primary={currentSettings.learningGranularity === 'significant'}
							class:text-bg-primary={currentSettings.learningGranularity === 'significant'}
							class:border-accent-primary={currentSettings.learningGranularity === 'significant'}
							class:text-text-secondary={currentSettings.learningGranularity !== 'significant'}
							class:border-surface-border={currentSettings.learningGranularity !== 'significant'}
						>
							Significant Only
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
							Record all decisions and outcomes. Most comprehensive.
						{:else if currentSettings.learningGranularity === 'significant'}
							Only high-confidence decisions and clear outcomes. Recommended.
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
						class="mx-4 mb-4 p-3 text-sm font-mono"
						class:border-green-500/30={testResult.success}
						class:bg-green-500/10={testResult.success}
						class:text-green-400={testResult.success}
						class:border-red-500/30={!testResult.success}
						class:bg-red-500/10={!testResult.success}
						class:text-red-400={!testResult.success}
						class:border={true}
					>
						{testResult.message}
					</div>
				{/if}
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
