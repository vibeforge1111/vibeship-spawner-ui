<script lang="ts">
	import { onMount } from 'svelte';
	import {
		liveModeStore,
		effectsSettings,
		soundManager,
		keyboardShortcuts,
		shortcutDefinitions
	} from '$lib/spawner-live';
	import type { EffectPreset, LiveMode } from '$lib/spawner-live/stores/live-mode.svelte';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	// Local state bound to stores
	let liveEnabled = $state(true);
	let mode = $state<LiveMode>('presentation');
	let preset = $state<EffectPreset>('balanced');
	let soundsEnabled = $state(true);
	let soundVolume = $state(0.3);
	let particlesEnabled = $state(true);
	let spotlightsEnabled = $state(true);
	let celebrationsEnabled = $state(true);

	// Active tab
	let activeTab = $state<'general' | 'effects' | 'audio' | 'shortcuts'>('general');

	onMount(() => {
		// Subscribe to live mode store
		const unsubLiveMode = liveModeStore.subscribe((state) => {
			liveEnabled = state.enabled;
			mode = state.mode;
			preset = state.preset;
		});

		// Subscribe to effects settings
		const unsubEffects = effectsSettings.subscribe((settings) => {
			particlesEnabled = settings.particles.enabled;
			spotlightsEnabled = settings.spotlights.enabled;
			celebrationsEnabled = settings.milestone.enabled;
		});

		// Subscribe to sound settings
		const unsubSound = soundManager.settings.subscribe((settings) => {
			soundsEnabled = settings.enabled;
			soundVolume = settings.volume;
		});

		return () => {
			unsubLiveMode();
			unsubEffects();
			unsubSound();
		};
	});

	// Handlers
	function handleLiveEnabledChange() {
		liveModeStore.setEnabled(liveEnabled);
	}

	function handleModeChange() {
		liveModeStore.setMode(mode);
	}

	function handlePresetChange() {
		liveModeStore.setPreset(preset);
	}

	function handleSoundsEnabledChange() {
		soundManager.setEnabled(soundsEnabled);
	}

	function handleVolumeChange() {
		soundManager.setVolume(soundVolume);
	}

	function handleParticlesChange() {
		effectsSettings.update((s) => ({
			...s,
			particles: { ...s.particles, enabled: particlesEnabled }
		}));
	}

	function handleSpotlightsChange() {
		effectsSettings.update((s) => ({
			...s,
			spotlights: { ...s.spotlights, enabled: spotlightsEnabled }
		}));
	}

	function handleCelebrationsChange() {
		effectsSettings.update((s) => ({
			...s,
			milestone: { ...s.milestone, enabled: celebrationsEnabled }
		}));
	}

	function testSounds() {
		soundManager.testAllSounds();
	}

	function resetToDefaults() {
		liveModeStore.reset();
		soundManager.setVolume(0.3);
		soundManager.setEnabled(true);
	}

	// Format shortcut key for display
	function formatShortcut(shortcut: (typeof shortcutDefinitions)[0]): string {
		return keyboardShortcuts.formatShortcut(shortcut);
	}
</script>

<div class="settings-panel">
	<div class="panel-header">
		<h3>Spawner Live Settings</h3>
		{#if onClose}
			<button class="close-btn" onclick={onClose}>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Tabs -->
	<div class="tabs">
		<button class:active={activeTab === 'general'} onclick={() => (activeTab = 'general')}>General</button>
		<button class:active={activeTab === 'effects'} onclick={() => (activeTab = 'effects')}>Effects</button>
		<button class:active={activeTab === 'audio'} onclick={() => (activeTab = 'audio')}>Audio</button>
		<button class:active={activeTab === 'shortcuts'} onclick={() => (activeTab = 'shortcuts')}>Shortcuts</button>
	</div>

	<div class="panel-content">
		<!-- General Tab -->
		{#if activeTab === 'general'}
			<div class="section">
				<div class="setting-row">
					<label>
						<input type="checkbox" bind:checked={liveEnabled} onchange={handleLiveEnabledChange} />
						<span>Enable Live Mode</span>
					</label>
					<p class="hint">Show real-time visual effects during pipeline execution</p>
				</div>

				<div class="setting-row">
					<label class="setting-label">Display Mode</label>
					<select bind:value={mode} onchange={handleModeChange}>
						<option value="presentation">Presentation</option>
						<option value="developer">Developer</option>
					</select>
					<p class="hint">
						{mode === 'presentation'
							? 'Clean view optimized for demos'
							: 'Shows technical details and logs'}
					</p>
				</div>

				<div class="setting-row">
					<label class="setting-label">Effects Preset</label>
					<select bind:value={preset} onchange={handlePresetChange}>
						<option value="minimal">Minimal</option>
						<option value="balanced">Balanced</option>
						<option value="maximum">Maximum</option>
					</select>
					<p class="hint">
						{preset === 'minimal'
							? 'Subtle effects, low resource usage'
							: preset === 'balanced'
								? 'Good balance of effects and performance'
								: 'Full effects, may impact performance'}
					</p>
				</div>
			</div>

			<div class="section">
				<button class="action-btn" onclick={resetToDefaults}>Reset to Defaults</button>
			</div>
		{/if}

		<!-- Effects Tab -->
		{#if activeTab === 'effects'}
			<div class="section">
				<h4>Visual Effects</h4>

				<div class="setting-row">
					<label>
						<input type="checkbox" bind:checked={particlesEnabled} onchange={handleParticlesChange} />
						<span>Particle Effects</span>
					</label>
					<p class="hint">Burst particles on node completion</p>
				</div>

				<div class="setting-row">
					<label>
						<input type="checkbox" bind:checked={spotlightsEnabled} onchange={handleSpotlightsChange} />
						<span>Spotlight Effects</span>
					</label>
					<p class="hint">Highlight active nodes with glow</p>
				</div>

				<div class="setting-row">
					<label>
						<input type="checkbox" bind:checked={celebrationsEnabled} onchange={handleCelebrationsChange} />
						<span>Celebration Effects</span>
					</label>
					<p class="hint">Confetti and banners on completion</p>
				</div>
			</div>
		{/if}

		<!-- Audio Tab -->
		{#if activeTab === 'audio'}
			<div class="section">
				<h4>Sound Effects</h4>

				<div class="setting-row">
					<label>
						<input type="checkbox" bind:checked={soundsEnabled} onchange={handleSoundsEnabledChange} />
						<span>Enable Sounds</span>
					</label>
					<p class="hint">Play audio cues during execution</p>
				</div>

				<div class="setting-row">
					<label class="setting-label">Volume</label>
					<div class="slider-row">
						<input
							type="range"
							min="0"
							max="1"
							step="0.1"
							bind:value={soundVolume}
							onchange={handleVolumeChange}
							disabled={!soundsEnabled}
						/>
						<span class="volume-value">{Math.round(soundVolume * 100)}%</span>
					</div>
				</div>

				<div class="setting-row">
					<button class="action-btn" onclick={testSounds} disabled={!soundsEnabled}>
						Test All Sounds
					</button>
				</div>
			</div>
		{/if}

		<!-- Shortcuts Tab -->
		{#if activeTab === 'shortcuts'}
			<div class="section">
				<h4>Keyboard Shortcuts</h4>
				<p class="hint">Active when Live Mode is enabled</p>

				<div class="shortcuts-list">
					{#each shortcutDefinitions as shortcut}
						<div class="shortcut-row">
							<kbd>{formatShortcut(shortcut)}</kbd>
							<span>{shortcut.description}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.settings-panel {
		background: var(--bg-secondary, #1a1a24);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 8px;
		width: 360px;
		max-height: 500px;
		display: flex;
		flex-direction: column;
		font-family: var(--font-mono, monospace);
		font-size: 12px;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.panel-header h3 {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-primary, #fff);
	}

	.close-btn {
		background: none;
		border: none;
		color: var(--text-tertiary, #666);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: var(--text-primary, #fff);
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid var(--surface-border, #2a2a3a);
	}

	.tabs button {
		flex: 1;
		padding: 8px 12px;
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-tertiary, #666);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tabs button:hover {
		color: var(--text-secondary, #888);
	}

	.tabs button.active {
		color: var(--accent-primary, #22c55e);
		border-bottom-color: var(--accent-primary, #22c55e);
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.section {
		margin-bottom: 16px;
	}

	.section h4 {
		margin: 0 0 12px 0;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--accent-primary, #22c55e);
	}

	.setting-row {
		margin-bottom: 12px;
	}

	.setting-row label {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-primary, #fff);
		cursor: pointer;
	}

	.setting-row input[type='checkbox'] {
		width: 14px;
		height: 14px;
		accent-color: var(--accent-primary, #22c55e);
	}

	.setting-label {
		display: block;
		margin-bottom: 6px;
		color: var(--text-secondary, #888);
		font-size: 11px;
	}

	.setting-row select {
		width: 100%;
		padding: 6px 10px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
	}

	.hint {
		margin: 4px 0 0 0;
		font-size: 10px;
		color: var(--text-tertiary, #666);
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.slider-row input[type='range'] {
		flex: 1;
		accent-color: var(--accent-primary, #22c55e);
	}

	.volume-value {
		min-width: 40px;
		text-align: right;
		color: var(--text-secondary, #888);
	}

	.action-btn {
		padding: 8px 16px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 11px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--surface-border, #2a2a3a);
		border-color: var(--accent-primary, #22c55e);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.shortcuts-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.shortcut-row kbd {
		min-width: 80px;
		padding: 4px 8px;
		background: var(--surface, #252530);
		border: 1px solid var(--surface-border, #2a2a3a);
		border-radius: 4px;
		font-family: var(--font-mono, monospace);
		font-size: 10px;
		color: var(--accent-primary, #22c55e);
		text-align: center;
	}

	.shortcut-row span {
		color: var(--text-secondary, #888);
		font-size: 11px;
	}

	/* Scrollbar */
	.panel-content::-webkit-scrollbar {
		width: 6px;
	}

	.panel-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.panel-content::-webkit-scrollbar-thumb {
		background: var(--surface-border, #2a2a3a);
		border-radius: 3px;
	}

	.panel-content::-webkit-scrollbar-thumb:hover {
		background: var(--text-tertiary, #666);
	}
</style>
