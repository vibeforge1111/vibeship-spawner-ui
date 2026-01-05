/**
 * Spawner Live - Sound Manager
 * Audio feedback for agent events
 */

import { writable, get } from 'svelte/store';
import { eventRouter } from '../orchestrator/event-router';
import type { AgentEvent } from '../types/events';

export interface SoundSettings {
	enabled: boolean;
	volume: number; // 0-1
	mutedTypes: Set<string>;
}

export type SoundType =
	| 'enter'
	| 'exit'
	| 'progress'
	| 'error'
	| 'handoff'
	| 'pipeline_start'
	| 'pipeline_complete'
	| 'pipeline_failed'
	| 'deviation';

// Synth-based sound generation using Web Audio API
class SoundManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private unsubscribe: (() => void) | null = null;
	private initialized = false;

	// Settings store
	public settings = writable<SoundSettings>({
		enabled: true,
		volume: 0.3,
		mutedTypes: new Set()
	});

	/**
	 * Initialize audio system
	 */
	init(): void {
		if (this.initialized) return;
		if (typeof window === 'undefined') return;

		try {
			this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
			this.masterGain = this.audioContext.createGain();
			this.masterGain.connect(this.audioContext.destination);
			this.masterGain.gain.value = get(this.settings).volume;

			// Subscribe to events
			this.unsubscribe = eventRouter.subscribe({
				id: 'sound-manager',
				callback: (event) => this.handleEvent(event)
			});

			// Watch settings for volume changes
			this.settings.subscribe((s) => {
				if (this.masterGain) {
					this.masterGain.gain.value = s.volume;
				}
			});

			this.initialized = true;
			console.log('[SoundManager] Initialized');
		} catch (error) {
			console.warn('[SoundManager] Failed to initialize:', error);
		}
	}

	/**
	 * Handle event
	 */
	private handleEvent(event: AgentEvent): void {
		const settings = get(this.settings);
		if (!settings.enabled) return;

		switch (event.type) {
			case 'agent_enter':
				this.play('enter');
				break;
			case 'agent_exit':
				this.play('exit');
				break;
			case 'agent_progress':
				// Only play on significant progress
				const progress = event.data?.progress as number;
				if (progress && progress % 25 === 0 && progress > 0 && progress < 100) {
					this.play('progress');
				}
				break;
			case 'agent_error':
				this.play('error');
				break;
			case 'handoff_start':
				this.play('handoff');
				break;
			case 'pipeline_start':
				this.play('pipeline_start');
				break;
			case 'pipeline_complete':
				this.play('pipeline_complete');
				break;
			case 'pipeline_failed':
				this.play('pipeline_failed');
				break;
			case 'deviation_warn':
				this.play('deviation');
				break;
		}
	}

	/**
	 * Play a sound by type
	 */
	play(type: SoundType): void {
		const settings = get(this.settings);
		if (!settings.enabled || settings.mutedTypes.has(type)) return;
		if (!this.audioContext || !this.masterGain) return;

		// Resume audio context if suspended (browser autoplay policy)
		if (this.audioContext.state === 'suspended') {
			this.audioContext.resume();
		}

		try {
			switch (type) {
				case 'enter':
					this.playTone(440, 0.1, 'sine', { attack: 0.01, decay: 0.09 });
					break;
				case 'exit':
					this.playTone(880, 0.15, 'sine', { attack: 0.01, decay: 0.14 });
					break;
				case 'progress':
					this.playTone(660, 0.05, 'sine', { attack: 0.01, decay: 0.04 });
					break;
				case 'error':
					this.playTone(200, 0.3, 'sawtooth', { attack: 0.01, decay: 0.29 });
					setTimeout(() => this.playTone(150, 0.3, 'sawtooth', { attack: 0.01, decay: 0.29 }), 100);
					break;
				case 'handoff':
					this.playTone(523, 0.1, 'sine', { attack: 0.01, decay: 0.09 });
					setTimeout(() => this.playTone(659, 0.1, 'sine', { attack: 0.01, decay: 0.09 }), 50);
					break;
				case 'pipeline_start':
					this.playChord([261, 329, 392], 0.3, 'sine');
					break;
				case 'pipeline_complete':
					this.playChord([392, 493, 587], 0.2, 'sine');
					setTimeout(() => this.playChord([523, 659, 783], 0.4, 'sine'), 150);
					break;
				case 'pipeline_failed':
					this.playChord([200, 250], 0.4, 'sawtooth');
					break;
				case 'deviation':
					this.playTone(350, 0.2, 'triangle', { attack: 0.01, decay: 0.19 });
					setTimeout(() => this.playTone(300, 0.2, 'triangle', { attack: 0.01, decay: 0.19 }), 100);
					break;
			}
		} catch (error) {
			console.warn('[SoundManager] Error playing sound:', error);
		}
	}

	/**
	 * Play a single tone
	 */
	private playTone(
		frequency: number,
		duration: number,
		type: OscillatorType,
		envelope: { attack: number; decay: number }
	): void {
		if (!this.audioContext || !this.masterGain) return;

		const oscillator = this.audioContext.createOscillator();
		const gainNode = this.audioContext.createGain();

		oscillator.type = type;
		oscillator.frequency.value = frequency;

		gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
		gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + envelope.attack);
		gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

		oscillator.connect(gainNode);
		gainNode.connect(this.masterGain);

		oscillator.start();
		oscillator.stop(this.audioContext.currentTime + duration);
	}

	/**
	 * Play a chord (multiple tones)
	 */
	private playChord(frequencies: number[], duration: number, type: OscillatorType): void {
		frequencies.forEach((freq) => {
			this.playTone(freq, duration, type, { attack: 0.02, decay: duration - 0.02 });
		});
	}

	/**
	 * Enable/disable sounds
	 */
	setEnabled(enabled: boolean): void {
		this.settings.update((s) => ({ ...s, enabled }));
	}

	/**
	 * Set volume (0-1)
	 */
	setVolume(volume: number): void {
		const clampedVolume = Math.max(0, Math.min(1, volume));
		this.settings.update((s) => ({ ...s, volume: clampedVolume }));
	}

	/**
	 * Mute specific sound type
	 */
	muteType(type: SoundType): void {
		this.settings.update((s) => {
			const newMuted = new Set(s.mutedTypes);
			newMuted.add(type);
			return { ...s, mutedTypes: newMuted };
		});
	}

	/**
	 * Unmute specific sound type
	 */
	unmuteType(type: SoundType): void {
		this.settings.update((s) => {
			const newMuted = new Set(s.mutedTypes);
			newMuted.delete(type);
			return { ...s, mutedTypes: newMuted };
		});
	}

	/**
	 * Test all sounds
	 */
	async testAllSounds(): Promise<void> {
		const types: SoundType[] = [
			'enter',
			'progress',
			'exit',
			'handoff',
			'error',
			'deviation',
			'pipeline_start',
			'pipeline_complete',
			'pipeline_failed'
		];

		for (const type of types) {
			console.log(`[SoundManager] Testing: ${type}`);
			this.play(type);
			await new Promise((r) => setTimeout(r, 600));
		}
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		if (this.audioContext) {
			this.audioContext.close();
			this.audioContext = null;
		}

		this.masterGain = null;
		this.initialized = false;

		console.log('[SoundManager] Destroyed');
	}

	/**
	 * Check if initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}
}

// Export singleton instance
export const soundManager = new SoundManager();

// Export class for testing
export { SoundManager };
