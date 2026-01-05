/**
 * Spawner Live - Keyboard Shortcuts
 * Global keyboard controls for live mode
 */

import { get } from 'svelte/store';
import { liveModeStore, isLiveEnabled } from '../stores';
import { pipelineRunner } from '../execution';
import { effectsEngine } from '../effects';

export interface KeyboardShortcut {
	key: string;
	ctrl?: boolean;
	shift?: boolean;
	alt?: boolean;
	meta?: boolean;
	description: string;
	action: () => void;
	category: 'execution' | 'mode' | 'effects' | 'navigation';
}

// Shortcut definitions
const shortcuts: KeyboardShortcut[] = [
	// Execution controls
	{
		key: ' ', // Space
		description: 'Pause/Resume execution',
		category: 'execution',
		action: () => {
			const state = pipelineRunner.getState();
			if (state.status === 'running') {
				pipelineRunner.pause();
			} else if (state.status === 'paused') {
				pipelineRunner.resume();
			}
		}
	},
	{
		key: 'Escape',
		description: 'Cancel execution',
		category: 'execution',
		action: () => {
			const state = pipelineRunner.getState();
			if (state.status === 'running' || state.status === 'paused') {
				pipelineRunner.cancel();
			}
		}
	},
	{
		key: 'r',
		ctrl: true,
		shift: true,
		description: 'Reset execution state',
		category: 'execution',
		action: () => {
			pipelineRunner.reset();
		}
	},

	// Mode controls
	{
		key: 'l',
		ctrl: true,
		description: 'Toggle live mode on/off',
		category: 'mode',
		action: () => {
			const store = get(liveModeStore);
			liveModeStore.setEnabled(!store.enabled);
		}
	},
	{
		key: 'm',
		ctrl: true,
		shift: true,
		description: 'Toggle presentation/developer mode',
		category: 'mode',
		action: () => {
			liveModeStore.toggle();
		}
	},
	{
		key: '1',
		alt: true,
		description: 'Set minimal effects preset',
		category: 'effects',
		action: () => {
			liveModeStore.setPreset('minimal');
		}
	},
	{
		key: '2',
		alt: true,
		description: 'Set balanced effects preset',
		category: 'effects',
		action: () => {
			liveModeStore.setPreset('balanced');
		}
	},
	{
		key: '3',
		alt: true,
		description: 'Set maximum effects preset',
		category: 'effects',
		action: () => {
			liveModeStore.setPreset('maximum');
		}
	},

	// Effects controls
	{
		key: 'p',
		ctrl: true,
		shift: true,
		description: 'Pause/Resume effects',
		category: 'effects',
		action: () => {
			// Toggle effects pause (effects engine doesn't have a toggle, so we use enabled)
			const store = get(liveModeStore);
			if (store.enabled) {
				effectsEngine.pause();
			} else {
				effectsEngine.resume();
			}
		}
	}
];

class KeyboardShortcuts {
	private enabled = false;
	private boundHandler: ((e: KeyboardEvent) => void) | null = null;

	/**
	 * Enable keyboard shortcuts
	 */
	enable(): void {
		if (this.enabled) return;

		this.boundHandler = this.handleKeyDown.bind(this);
		window.addEventListener('keydown', this.boundHandler);
		this.enabled = true;

		console.log('[KeyboardShortcuts] Enabled');
	}

	/**
	 * Disable keyboard shortcuts
	 */
	disable(): void {
		if (!this.enabled) return;

		if (this.boundHandler) {
			window.removeEventListener('keydown', this.boundHandler);
			this.boundHandler = null;
		}
		this.enabled = false;

		console.log('[KeyboardShortcuts] Disabled');
	}

	/**
	 * Handle keydown event
	 */
	private handleKeyDown(e: KeyboardEvent): void {
		// Skip if typing in input
		if (this.isTypingInInput(e)) return;

		// Skip if live mode is not enabled (except for toggle shortcut)
		const liveEnabled = get(isLiveEnabled);

		for (const shortcut of shortcuts) {
			if (this.matchesShortcut(e, shortcut)) {
				// Allow live mode toggle even when disabled
				if (!liveEnabled && shortcut.key !== 'l') continue;

				e.preventDefault();
				shortcut.action();
				return;
			}
		}
	}

	/**
	 * Check if event matches shortcut
	 */
	private matchesShortcut(e: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
		const keyMatch = e.key === shortcut.key || e.key.toLowerCase() === shortcut.key.toLowerCase();
		const ctrlMatch = !!shortcut.ctrl === (e.ctrlKey || e.metaKey);
		const shiftMatch = !!shortcut.shift === e.shiftKey;
		const altMatch = !!shortcut.alt === e.altKey;

		return keyMatch && ctrlMatch && shiftMatch && altMatch;
	}

	/**
	 * Check if user is typing in an input
	 */
	private isTypingInInput(e: KeyboardEvent): boolean {
		const target = e.target as HTMLElement;
		const tagName = target.tagName.toLowerCase();

		// Skip for input, textarea, select, and contenteditable
		if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
			return true;
		}

		if (target.isContentEditable) {
			return true;
		}

		return false;
	}

	/**
	 * Get all shortcuts
	 */
	getShortcuts(): KeyboardShortcut[] {
		return [...shortcuts];
	}

	/**
	 * Get shortcuts by category
	 */
	getShortcutsByCategory(category: KeyboardShortcut['category']): KeyboardShortcut[] {
		return shortcuts.filter((s) => s.category === category);
	}

	/**
	 * Format shortcut for display
	 */
	formatShortcut(shortcut: KeyboardShortcut): string {
		const parts: string[] = [];

		if (shortcut.ctrl) parts.push('Ctrl');
		if (shortcut.alt) parts.push('Alt');
		if (shortcut.shift) parts.push('Shift');
		if (shortcut.meta) parts.push('Cmd');

		// Format key
		let key = shortcut.key;
		if (key === ' ') key = 'Space';
		if (key.length === 1) key = key.toUpperCase();

		parts.push(key);

		return parts.join('+');
	}

	/**
	 * Check if enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}
}

// Export singleton instance
export const keyboardShortcuts = new KeyboardShortcuts();

// Export class for testing
export { KeyboardShortcuts };

// Export shortcuts for UI display
export { shortcuts as shortcutDefinitions };
