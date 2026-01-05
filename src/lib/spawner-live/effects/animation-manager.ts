/**
 * Spawner Live - Animation Manager
 * Handles CSS/JS animations for nodes
 */

import { writable, get } from 'svelte/store';

// Active animations tracking
const activeAnimations = new Map<string, Animation[]>();
const animationQueue = new Map<string, (() => void)[]>();

// Stores for UI reactivity
export const activeNodeAnimations = writable<Set<string>>(new Set());
export const agentIndicators = writable<Map<string, { agentId: string; color: string }>>(new Map());
export const progressRings = writable<Map<string, number>>(new Map());

class AnimationManager {
	/**
	 * Scale a node with animation
	 */
	scaleNode(nodeId: string, scale: number, duration: number = 300): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		this.cancelAnimations(nodeId);

		const animation = element.animate(
			[{ transform: `scale(${element.style.transform || 1})` }, { transform: `scale(${scale})` }],
			{
				duration,
				easing: 'ease-out',
				fill: 'forwards'
			}
		);

		this.trackAnimation(nodeId, animation);

		animation.onfinish = () => {
			element.style.transform = `scale(${scale})`;
			this.removeAnimation(nodeId, animation);
		};
	}

	/**
	 * Pulse effect on a node
	 */
	pulseNode(nodeId: string, color: string, duration: number = 500): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		const animation = element.animate(
			[
				{ boxShadow: `0 0 0 0 ${color}00` },
				{ boxShadow: `0 0 30px 10px ${color}80` },
				{ boxShadow: `0 0 0 0 ${color}00` }
			],
			{
				duration,
				easing: 'ease-out'
			}
		);

		this.trackAnimation(nodeId, animation);
		animation.onfinish = () => this.removeAnimation(nodeId, animation);
	}

	/**
	 * Shake animation for errors
	 */
	shakeNode(
		nodeId: string,
		options: { intensity?: number; cycles?: number } = {}
	): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		const { intensity = 5, cycles = 3 } = options;
		const keyframes: Keyframe[] = [{ transform: 'translateX(0)' }];

		for (let i = 0; i < cycles; i++) {
			keyframes.push({ transform: `translateX(-${intensity}px)` });
			keyframes.push({ transform: `translateX(${intensity}px)` });
		}
		keyframes.push({ transform: 'translateX(0)' });

		const animation = element.animate(keyframes, {
			duration: 100 * cycles,
			easing: 'ease-in-out'
		});

		this.trackAnimation(nodeId, animation);
		animation.onfinish = () => this.removeAnimation(nodeId, animation);
	}

	/**
	 * Breathing animation for idle nodes
	 */
	breatheNode(nodeId: string): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		const animation = element.animate(
			[{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
			{
				duration: 3000,
				iterations: Infinity,
				easing: 'ease-in-out'
			}
		);

		this.trackAnimation(nodeId, animation);
	}

	/**
	 * Stop breathing animation
	 */
	stopBreathing(nodeId: string): void {
		this.cancelAnimations(nodeId);
	}

	/**
	 * Show spotlight glow around node
	 */
	showSpotlight(
		nodeId: string,
		options: { color?: string; intensity?: number } = {}
	): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		const { color = '#3b82f6', intensity = 0.6 } = options;
		const glowSize = 20 + intensity * 30;

		element.style.filter = `drop-shadow(0 0 ${glowSize}px ${color})`;
		element.classList.add('spawner-live-spotlight');

		// Pulsing glow animation
		const animation = element.animate(
			[
				{ filter: `drop-shadow(0 0 ${glowSize * 0.8}px ${color})` },
				{ filter: `drop-shadow(0 0 ${glowSize * 1.2}px ${color})` },
				{ filter: `drop-shadow(0 0 ${glowSize * 0.8}px ${color})` }
			],
			{
				duration: 2000,
				iterations: Infinity,
				easing: 'ease-in-out'
			}
		);

		this.trackAnimation(nodeId, animation);

		activeNodeAnimations.update((set) => {
			set.add(nodeId);
			return new Set(set);
		});
	}

	/**
	 * Hide spotlight
	 */
	hideSpotlight(nodeId: string): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		element.style.filter = '';
		element.classList.remove('spawner-live-spotlight');
		this.cancelAnimations(nodeId);

		activeNodeAnimations.update((set) => {
			set.delete(nodeId);
			return new Set(set);
		});
	}

	/**
	 * Show agent indicator (glowing orb)
	 */
	showAgentIndicator(nodeId: string, agentId: string, color: string = '#8b5cf6'): void {
		agentIndicators.update((map) => {
			map.set(nodeId, { agentId, color });
			return new Map(map);
		});
	}

	/**
	 * Hide agent indicator
	 */
	hideAgentIndicator(nodeId: string): void {
		agentIndicators.update((map) => {
			map.delete(nodeId);
			return new Map(map);
		});
	}

	/**
	 * Update progress ring
	 */
	updateProgressRing(nodeId: string, progress: number): void {
		progressRings.update((map) => {
			map.set(nodeId, Math.min(100, Math.max(0, progress)));
			return new Map(map);
		});
	}

	/**
	 * Clear progress ring
	 */
	clearProgressRing(nodeId: string): void {
		progressRings.update((map) => {
			map.delete(nodeId);
			return new Map(map);
		});
	}

	/**
	 * Highlight node briefly
	 */
	highlightNode(nodeId: string, color: string = '#f59e0b', duration: number = 1000): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		const originalBackground = element.style.backgroundColor;

		element.animate(
			[
				{ backgroundColor: originalBackground || 'transparent' },
				{ backgroundColor: color },
				{ backgroundColor: originalBackground || 'transparent' }
			],
			{
				duration,
				easing: 'ease-out'
			}
		);
	}

	/**
	 * Fade node in/out
	 */
	fadeNode(nodeId: string, opacity: number, duration: number = 300): void {
		const element = this.getNodeElement(nodeId);
		if (!element) return;

		element.animate([{ opacity: element.style.opacity || 1 }, { opacity }], {
			duration,
			easing: 'ease-out',
			fill: 'forwards'
		});
	}

	/**
	 * Get DOM element for a node
	 */
	private getNodeElement(nodeId: string): HTMLElement | null {
		return document.querySelector(`[data-node-id="${nodeId}"]`);
	}

	/**
	 * Track an animation for a node
	 */
	private trackAnimation(nodeId: string, animation: Animation): void {
		const existing = activeAnimations.get(nodeId) || [];
		existing.push(animation);
		activeAnimations.set(nodeId, existing);
	}

	/**
	 * Remove a completed animation
	 */
	private removeAnimation(nodeId: string, animation: Animation): void {
		const existing = activeAnimations.get(nodeId) || [];
		const filtered = existing.filter((a) => a !== animation);
		if (filtered.length > 0) {
			activeAnimations.set(nodeId, filtered);
		} else {
			activeAnimations.delete(nodeId);
		}
	}

	/**
	 * Cancel all animations for a node
	 */
	cancelAnimations(nodeId: string): void {
		const animations = activeAnimations.get(nodeId) || [];
		animations.forEach((animation) => {
			animation.cancel();
		});
		activeAnimations.delete(nodeId);
	}

	/**
	 * Cancel all animations
	 */
	cancelAll(): void {
		activeAnimations.forEach((animations) => {
			animations.forEach((animation) => animation.cancel());
		});
		activeAnimations.clear();
		activeNodeAnimations.set(new Set());
		agentIndicators.set(new Map());
		progressRings.set(new Map());
	}

	/**
	 * Check if node has active animations
	 */
	hasActiveAnimations(nodeId: string): boolean {
		const animations = activeAnimations.get(nodeId) || [];
		return animations.some((a) => a.playState === 'running');
	}

	/**
	 * Get count of active animations
	 */
	getActiveAnimationCount(): number {
		let count = 0;
		activeAnimations.forEach((animations) => {
			count += animations.filter((a) => a.playState === 'running').length;
		});
		return count;
	}
}

// Export singleton instance
export const animationManager = new AnimationManager();

// Export class for testing
export { AnimationManager };
