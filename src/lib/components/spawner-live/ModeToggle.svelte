<script lang="ts">
	import { liveModeStore, isPresentationMode, isDeveloperMode, currentPreset } from '$lib/spawner-live/stores';

	let showSettings = $state(false);

	function handleToggle() {
		liveModeStore.toggle();
	}

	function handleKeydown(event: KeyboardEvent) {
		// Cmd/Ctrl + Shift + L to toggle
		if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'L') {
			event.preventDefault();
			handleToggle();
		}
	}

	function setPreset(preset: 'minimal' | 'balanced' | 'maximum') {
		liveModeStore.setPreset(preset);
		showSettings = false;
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="mode-toggle-container">
	<button
		class="mode-toggle"
		class:presentation={$isPresentationMode}
		class:developer={$isDeveloperMode}
		onclick={handleToggle}
		title="Toggle Live Mode (Ctrl+Shift+L)"
	>
		<span class="toggle-track">
			<span class="toggle-thumb" class:right={$isDeveloperMode}>
				{#if $isPresentationMode}
					<!-- Presentation icon (sparkles) -->
					<svg viewBox="0 0 24 24" fill="currentColor" class="icon">
						<path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" />
						<path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" opacity="0.7" />
					</svg>
				{:else}
					<!-- Developer icon (code) -->
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon">
						<polyline points="16,18 22,12 16,6" />
						<polyline points="8,6 2,12 8,18" />
					</svg>
				{/if}
			</span>
		</span>
		<span class="mode-label">
			{$isPresentationMode ? 'Live' : 'Dev'}
		</span>
	</button>

	<button
		class="settings-button"
		onclick={() => showSettings = !showSettings}
		title="Effect Settings"
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-small">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</svg>
	</button>

	{#if showSettings}
		<div class="settings-dropdown">
			<div class="settings-header">Effect Intensity</div>
			<div class="preset-buttons">
				<button
					class="preset-button"
					class:active={$currentPreset === 'minimal'}
					onclick={() => setPreset('minimal')}
				>
					Minimal
				</button>
				<button
					class="preset-button"
					class:active={$currentPreset === 'balanced'}
					onclick={() => setPreset('balanced')}
				>
					Balanced
				</button>
				<button
					class="preset-button"
					class:active={$currentPreset === 'maximum'}
					onclick={() => setPreset('maximum')}
				>
					Maximum
				</button>
			</div>
			<div class="keyboard-hint">
				<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>L</kbd> to toggle
			</div>
		</div>
	{/if}
</div>

<style>
	.mode-toggle-container {
		display: flex;
		align-items: center;
		gap: 4px;
		position: relative;
	}

	.mode-toggle {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: var(--bg-secondary, #1e1e2e);
		border: 1px solid var(--border-color, #313244);
		border-radius: 20px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.mode-toggle:hover {
		border-color: var(--border-hover, #45475a);
	}

	.mode-toggle.presentation {
		background: linear-gradient(135deg, #3b82f620, #8b5cf620);
		border-color: #3b82f640;
	}

	.mode-toggle.developer {
		background: linear-gradient(135deg, #22c55e20, #10b98120);
		border-color: #22c55e40;
	}

	.toggle-track {
		width: 36px;
		height: 20px;
		background: var(--bg-tertiary, #313244);
		border-radius: 10px;
		position: relative;
		transition: background 0.2s ease;
	}

	.mode-toggle.presentation .toggle-track {
		background: #3b82f630;
	}

	.mode-toggle.developer .toggle-track {
		background: #22c55e30;
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: white;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease;
	}

	.toggle-thumb.right {
		transform: translateX(16px);
	}

	.mode-toggle.presentation .toggle-thumb {
		background: #3b82f6;
		color: white;
	}

	.mode-toggle.developer .toggle-thumb {
		background: #22c55e;
		color: white;
	}

	.icon {
		width: 10px;
		height: 10px;
	}

	.mode-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-primary, #cdd6f4);
		min-width: 28px;
	}

	.settings-button {
		padding: 6px;
		background: var(--bg-secondary, #1e1e2e);
		border: 1px solid var(--border-color, #313244);
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #a6adc8);
		transition: all 0.2s ease;
	}

	.settings-button:hover {
		border-color: var(--border-hover, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.icon-small {
		width: 14px;
		height: 14px;
	}

	.settings-dropdown {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 8px;
		padding: 12px;
		background: var(--bg-secondary, #1e1e2e);
		border: 1px solid var(--border-color, #313244);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		z-index: 100;
		min-width: 180px;
	}

	.settings-header {
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary, #a6adc8);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 8px;
	}

	.preset-buttons {
		display: flex;
		gap: 4px;
	}

	.preset-button {
		flex: 1;
		padding: 6px 8px;
		background: var(--bg-tertiary, #313244);
		border: 1px solid transparent;
		border-radius: 4px;
		font-size: 11px;
		color: var(--text-secondary, #a6adc8);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.preset-button:hover {
		background: var(--bg-hover, #45475a);
		color: var(--text-primary, #cdd6f4);
	}

	.preset-button.active {
		background: #3b82f630;
		border-color: #3b82f6;
		color: #3b82f6;
	}

	.keyboard-hint {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-color, #313244);
		font-size: 11px;
		color: var(--text-muted, #6c7086);
		text-align: center;
	}

	kbd {
		display: inline-block;
		padding: 2px 6px;
		background: var(--bg-tertiary, #313244);
		border-radius: 4px;
		font-family: monospace;
		font-size: 10px;
	}
</style>
