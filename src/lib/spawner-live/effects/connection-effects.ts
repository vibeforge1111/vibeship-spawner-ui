/**
 * Spawner Live - Connection Effects
 * Visual effects for connections (pulses, glows, data flow)
 */

import { writable } from 'svelte/store';
import type { ConnectionPulseConfig, TravelingPulseConfig } from '../types/animation';

interface ActiveConnectionEffect {
	sourceId: string;
	targetId: string;
	type: 'spotlight' | 'pulse' | 'flow';
	element: SVGElement | null;
	animation: Animation | null;
	startTime: number;
}

// Connection key helper
function connectionKey(sourceId: string, targetId: string): string {
	return `${sourceId}->${targetId}`;
}

class ConnectionEffects {
	private effects = new Map<string, ActiveConnectionEffect>();
	private flowIntervals = new Map<string, ReturnType<typeof setInterval>>();

	// Svelte stores
	public activeConnections = writable<Set<string>>(new Set());
	public pulsingConnections = writable<Set<string>>(new Set());

	/**
	 * Find connection SVG element
	 */
	private findConnectionElement(sourceId: string, targetId: string): SVGElement | null {
		// Try multiple selector patterns
		const selectors = [
			`[data-connection="${sourceId}-${targetId}"]`,
			`[data-source="${sourceId}"][data-target="${targetId}"]`,
			`.connection-line[data-from="${sourceId}"][data-to="${targetId}"]`
		];

		for (const selector of selectors) {
			const element = document.querySelector(selector) as SVGElement;
			if (element) return element;
		}

		return null;
	}

	/**
	 * Spotlight a connection (glow effect)
	 */
	spotlight(
		sourceId: string,
		targetId: string,
		config: { duration?: number; color?: string; intensity?: number } = {}
	): void {
		const key = connectionKey(sourceId, targetId);
		const { duration = 2000, color = '#f59e0b', intensity = 0.8 } = config;

		const element = this.findConnectionElement(sourceId, targetId);
		if (!element) {
			console.warn(`[ConnectionEffects] Connection not found: ${sourceId} -> ${targetId}`);
			return;
		}

		// Cancel existing effect
		this.clearSpotlight(sourceId, targetId);

		// Apply glow filter
		const glowSize = 5 + intensity * 10;
		element.style.filter = `drop-shadow(0 0 ${glowSize}px ${color})`;
		element.style.stroke = color;
		element.style.strokeWidth = '3';

		// Pulsing animation
		const animation = element.animate(
			[
				{ filter: `drop-shadow(0 0 ${glowSize * 0.7}px ${color})`, strokeWidth: '2.5' },
				{ filter: `drop-shadow(0 0 ${glowSize * 1.3}px ${color})`, strokeWidth: '3.5' },
				{ filter: `drop-shadow(0 0 ${glowSize * 0.7}px ${color})`, strokeWidth: '2.5' }
			],
			{
				duration: 1000,
				iterations: Math.ceil(duration / 1000),
				easing: 'ease-in-out'
			}
		);

		// Track effect
		this.effects.set(key, {
			sourceId,
			targetId,
			type: 'spotlight',
			element,
			animation,
			startTime: Date.now()
		});

		// Update store
		this.activeConnections.update((set) => {
			set.add(key);
			return new Set(set);
		});

		// Auto-clear after duration
		setTimeout(() => this.clearSpotlight(sourceId, targetId), duration);
	}

	/**
	 * Clear spotlight effect
	 */
	clearSpotlight(sourceId: string, targetId: string): void {
		const key = connectionKey(sourceId, targetId);
		const effect = this.effects.get(key);

		if (!effect) return;

		// Cancel animation
		if (effect.animation) {
			effect.animation.cancel();
		}

		// Reset styles
		if (effect.element) {
			effect.element.style.filter = '';
			effect.element.style.stroke = '';
			effect.element.style.strokeWidth = '';
		}

		// Remove tracking
		this.effects.delete(key);

		// Update store
		this.activeConnections.update((set) => {
			set.delete(key);
			return new Set(set);
		});
	}

	/**
	 * Send a traveling pulse along a connection
	 */
	travelingPulse(
		sourceId: string,
		targetId: string,
		config: Partial<TravelingPulseConfig> = {}
	): void {
		const { duration = 800, color = '#3b82f6', size = 8, trail = true, trailLength = 20 } = config;

		const key = connectionKey(sourceId, targetId);
		const connectionElement = this.findConnectionElement(sourceId, targetId);

		if (!connectionElement) {
			console.warn(`[ConnectionEffects] Connection not found: ${sourceId} -> ${targetId}`);
			return;
		}

		// Get the path element
		const path = connectionElement.querySelector('path') || connectionElement;
		if (!(path instanceof SVGPathElement)) {
			console.warn('[ConnectionEffects] No path element found in connection');
			return;
		}

		// Get path length
		const pathLength = path.getTotalLength();

		// Create pulse element
		const svgNs = 'http://www.w3.org/2000/svg';
		const pulse = document.createElementNS(svgNs, 'circle');
		pulse.setAttribute('r', size.toString());
		pulse.setAttribute('fill', color);
		pulse.setAttribute('filter', `drop-shadow(0 0 ${size}px ${color})`);
		pulse.classList.add('traveling-pulse');

		// Add to same parent as connection
		const parent = connectionElement.parentElement;
		if (parent) {
			parent.appendChild(pulse);
		}

		// Animate along path
		let startTime: number | null = null;
		const animate = (timestamp: number) => {
			if (!startTime) startTime = timestamp;
			const elapsed = timestamp - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Get point along path
			const point = path.getPointAtLength(progress * pathLength);
			pulse.setAttribute('cx', point.x.toString());
			pulse.setAttribute('cy', point.y.toString());

			// Fade out near end
			if (progress > 0.8) {
				pulse.setAttribute('opacity', ((1 - progress) * 5).toString());
			}

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Remove pulse element
				pulse.remove();
			}
		};

		requestAnimationFrame(animate);

		// Update store
		this.pulsingConnections.update((set) => {
			set.add(key);
			return new Set(set);
		});

		// Clear from store after duration
		setTimeout(() => {
			this.pulsingConnections.update((set) => {
				set.delete(key);
				return new Set(set);
			});
		}, duration);
	}

	/**
	 * Start continuous data flow visualization
	 */
	startFlow(
		sourceId: string,
		targetId: string,
		config: Partial<ConnectionPulseConfig> = {}
	): void {
		const key = connectionKey(sourceId, targetId);
		const { color = '#3b82f6', speed = 500 } = config;

		// Clear any existing flow
		this.stopFlow(sourceId, targetId);

		// Start interval for continuous pulses
		const interval = setInterval(() => {
			this.travelingPulse(sourceId, targetId, {
				duration: speed * 2,
				color,
				size: 5,
				trail: true
			});
		}, speed);

		this.flowIntervals.set(key, interval);

		// Also add spotlight
		this.spotlight(sourceId, targetId, {
			duration: Infinity,
			color,
			intensity: 0.5
		});
	}

	/**
	 * Stop continuous data flow
	 */
	stopFlow(sourceId: string, targetId: string): void {
		const key = connectionKey(sourceId, targetId);

		const interval = this.flowIntervals.get(key);
		if (interval) {
			clearInterval(interval);
			this.flowIntervals.delete(key);
		}

		this.clearSpotlight(sourceId, targetId);
	}

	/**
	 * Error pulse (red, shaking)
	 */
	errorPulse(sourceId: string, targetId: string): void {
		const element = this.findConnectionElement(sourceId, targetId);
		if (!element) return;

		// Red color flash
		element.animate(
			[
				{ stroke: '#ef4444', strokeWidth: '4', filter: 'drop-shadow(0 0 10px #ef4444)' },
				{ stroke: '', strokeWidth: '', filter: '' }
			],
			{
				duration: 500,
				easing: 'ease-out'
			}
		);
	}

	/**
	 * Success pulse (green burst)
	 */
	successPulse(sourceId: string, targetId: string): void {
		this.travelingPulse(sourceId, targetId, {
			color: '#22c55e',
			duration: 600,
			size: 10
		});
	}

	/**
	 * Highlight a connection path
	 */
	highlightPath(nodeIds: string[], color: string = '#f59e0b'): void {
		for (let i = 0; i < nodeIds.length - 1; i++) {
			this.spotlight(nodeIds[i], nodeIds[i + 1], { color, duration: 3000 });
		}
	}

	/**
	 * Clear all effects
	 */
	clearAll(): void {
		// Clear spotlights
		this.effects.forEach((effect, key) => {
			const [sourceId, targetId] = key.split('->');
			this.clearSpotlight(sourceId, targetId);
		});

		// Clear flows
		this.flowIntervals.forEach((interval, key) => {
			clearInterval(interval);
		});
		this.flowIntervals.clear();

		// Clear stores
		this.activeConnections.set(new Set());
		this.pulsingConnections.set(new Set());
	}

	/**
	 * Check if connection has active effect
	 */
	isActive(sourceId: string, targetId: string): boolean {
		return this.effects.has(connectionKey(sourceId, targetId));
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		this.clearAll();
	}
}

// Export singleton instance
export const connectionEffects = new ConnectionEffects();

// Export class for testing
export { ConnectionEffects };
