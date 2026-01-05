/**
 * Spawner Live - Spotlight Manager
 * Manages spotlight/glow effects on active nodes
 */

import { writable, derived } from 'svelte/store';
import type { SpotlightConfig } from '../types/animation';

interface ActiveSpotlight {
	nodeId: string;
	config: SpotlightConfig;
	element: HTMLElement | null;
	animation: Animation | null;
	startTime: number;
}

// Default spotlight config - Vibeship minimal style
const defaultConfig: SpotlightConfig = {
	color: '#00C49A',
	intensity: 0.15,
	radius: 8,
	blur: 6,
	pulseSpeed: 3000
};

class SpotlightManager {
	private spotlights = new Map<string, ActiveSpotlight>();

	// Svelte stores
	public activeSpotlights = writable<Map<string, SpotlightConfig>>(new Map());
	public spotlightCount = derived(this.activeSpotlights, ($spotlights) => $spotlights.size);

	/**
	 * Activate spotlight on a node
	 */
	activate(nodeId: string, config: Partial<SpotlightConfig> = {}): void {
		// Merge with defaults
		const finalConfig: SpotlightConfig = { ...defaultConfig, ...config };

		// Get DOM element
		const element = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement;
		if (!element) {
			console.warn(`[SpotlightManager] Node element not found: ${nodeId}`);
			return;
		}

		// Cancel existing spotlight on this node
		if (this.spotlights.has(nodeId)) {
			this.deactivate(nodeId);
		}

		// Create spotlight effect - minimal Vibeship style
		const glowSize = finalConfig.radius + (finalConfig.intensity * 8);

		// Apply subtle spotlight style
		element.style.filter = `drop-shadow(0 0 ${glowSize}px ${finalConfig.color}40)`;
		element.style.zIndex = '10';
		element.dataset.spotlightActive = 'true';

		// Create very subtle pulsing animation
		let animation: Animation | null = null;
		if (finalConfig.pulseSpeed && finalConfig.pulseSpeed > 0) {
			animation = element.animate(
				[
					{ filter: `drop-shadow(0 0 ${glowSize * 0.9}px ${finalConfig.color}30)` },
					{ filter: `drop-shadow(0 0 ${glowSize * 1.1}px ${finalConfig.color}50)` },
					{ filter: `drop-shadow(0 0 ${glowSize * 0.9}px ${finalConfig.color}30)` }
				],
				{
					duration: finalConfig.pulseSpeed,
					iterations: Infinity,
					easing: 'ease-in-out'
				}
			);
		}

		// Store spotlight data
		this.spotlights.set(nodeId, {
			nodeId,
			config: finalConfig,
			element,
			animation,
			startTime: Date.now()
		});

		// Update store
		this.activeSpotlights.update((map) => {
			map.set(nodeId, finalConfig);
			return new Map(map);
		});
	}

	/**
	 * Deactivate spotlight on a node
	 */
	deactivate(nodeId: string): void {
		const spotlight = this.spotlights.get(nodeId);
		if (!spotlight) return;

		// Cancel animation
		if (spotlight.animation) {
			spotlight.animation.cancel();
		}

		// Reset element styles
		if (spotlight.element) {
			spotlight.element.style.filter = '';
			spotlight.element.style.zIndex = '';
			delete spotlight.element.dataset.spotlightActive;
		}

		// Remove from tracking
		this.spotlights.delete(nodeId);

		// Update store
		this.activeSpotlights.update((map) => {
			map.delete(nodeId);
			return new Map(map);
		});
	}

	/**
	 * Update spotlight configuration
	 */
	update(nodeId: string, config: Partial<SpotlightConfig>): void {
		const spotlight = this.spotlights.get(nodeId);
		if (!spotlight) return;

		// Re-activate with new config
		this.activate(nodeId, { ...spotlight.config, ...config });
	}

	/**
	 * Set spotlight color
	 */
	setColor(nodeId: string, color: string): void {
		this.update(nodeId, { color });
	}

	/**
	 * Set spotlight intensity
	 */
	setIntensity(nodeId: string, intensity: number): void {
		this.update(nodeId, { intensity: Math.max(0, Math.min(1, intensity)) });
	}

	/**
	 * Flash a spotlight briefly
	 */
	flash(nodeId: string, config: Partial<SpotlightConfig> = {}, duration: number = 500): void {
		this.activate(nodeId, config);
		setTimeout(() => this.deactivate(nodeId), duration);
	}

	/**
	 * Check if node has active spotlight
	 */
	isActive(nodeId: string): boolean {
		return this.spotlights.has(nodeId);
	}

	/**
	 * Get spotlight config for a node
	 */
	getConfig(nodeId: string): SpotlightConfig | null {
		return this.spotlights.get(nodeId)?.config || null;
	}

	/**
	 * Get all active spotlight node IDs
	 */
	getActiveNodeIds(): string[] {
		return Array.from(this.spotlights.keys());
	}

	/**
	 * Deactivate all spotlights
	 */
	deactivateAll(): void {
		this.spotlights.forEach((_, nodeId) => {
			this.deactivate(nodeId);
		});
	}

	/**
	 * Transition spotlight from one node to another
	 */
	transition(fromNodeId: string, toNodeId: string, duration: number = 300): void {
		const fromSpotlight = this.spotlights.get(fromNodeId);
		const config = fromSpotlight?.config || defaultConfig;

		// Fade out old spotlight
		this.fadeOut(fromNodeId, duration);

		// Activate new spotlight after brief delay
		setTimeout(() => {
			this.activate(toNodeId, config);
		}, duration / 2);
	}

	/**
	 * Fade out a spotlight
	 */
	private fadeOut(nodeId: string, duration: number): void {
		const spotlight = this.spotlights.get(nodeId);
		if (!spotlight || !spotlight.element) return;

		// Cancel existing animation
		if (spotlight.animation) {
			spotlight.animation.cancel();
		}

		// Fade out animation
		const element = spotlight.element;
		const fadeAnimation = element.animate(
			[
				{ filter: element.style.filter },
				{ filter: 'drop-shadow(0 0 0px transparent)' }
			],
			{
				duration,
				easing: 'ease-out',
				fill: 'forwards'
			}
		);

		fadeAnimation.onfinish = () => {
			this.deactivate(nodeId);
		};
	}

	/**
	 * Get duration a spotlight has been active
	 */
	getActiveDuration(nodeId: string): number {
		const spotlight = this.spotlights.get(nodeId);
		if (!spotlight) return 0;
		return Date.now() - spotlight.startTime;
	}

	/**
	 * Cleanup all resources
	 */
	destroy(): void {
		this.deactivateAll();
		this.spotlights.clear();
	}
}

// Export singleton instance
export const spotlightManager = new SpotlightManager();

// Export class for testing
export { SpotlightManager };
