/**
 * Spawner Live - Celebration Effects
 * Confetti, banners, and vignettes for milestones
 */

import { writable } from 'svelte/store';
import type { ConfettiConfig, BannerConfig, VignetteConfig } from '../types/animation';

// Default configurations
const defaultConfettiConfig: ConfettiConfig = {
	count: 100,
	colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
	duration: 3000,
	spread: 70,
	origin: { x: 0.5, y: 0.3 },
	gravity: 1,
	shapes: ['square', 'circle']
};

const defaultBannerConfig: BannerConfig = {
	message: 'Success!',
	type: 'success',
	duration: 2000,
	position: 'center',
	animation: 'bounce'
};

const defaultVignetteConfig: VignetteConfig = {
	color: '#ef4444',
	intensity: 0.3,
	duration: 1000,
	animation: 'pulse'
};

// Banner store for Svelte components
export const activeBanner = writable<BannerConfig | null>(null);
export const activeVignette = writable<VignetteConfig | null>(null);

class Celebration {
	private confettiContainer: HTMLElement | null = null;
	private bannerTimeout: ReturnType<typeof setTimeout> | null = null;
	private vignetteTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Initialize celebration system
	 */
	init(): void {
		// Create confetti container if it doesn't exist
		if (!this.confettiContainer) {
			this.confettiContainer = document.createElement('div');
			this.confettiContainer.id = 'spawner-live-confetti';
			this.confettiContainer.style.cssText = `
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				pointer-events: none;
				z-index: 9999;
				overflow: hidden;
			`;
			document.body.appendChild(this.confettiContainer);
		}
	}

	/**
	 * Launch confetti celebration
	 */
	confetti(config: Partial<ConfettiConfig> = {}): void {
		this.init();
		const finalConfig = { ...defaultConfettiConfig, ...config };

		if (!this.confettiContainer) return;

		const { count, colors, duration, spread, origin, gravity, shapes } = finalConfig;

		// Create confetti pieces
		for (let i = 0; i < count; i++) {
			const piece = document.createElement('div');
			piece.className = 'confetti-piece';

			// Random properties
			const color = colors[Math.floor(Math.random() * colors.length)];
			const shape = shapes[Math.floor(Math.random() * shapes.length)];
			const size = 8 + Math.random() * 8;
			const startX = origin.x * window.innerWidth + (Math.random() - 0.5) * spread * 10;
			const startY = origin.y * window.innerHeight;

			// Velocity
			const angle = -90 + (Math.random() - 0.5) * spread;
			const velocity = 5 + Math.random() * 10;
			const vx = Math.cos((angle * Math.PI) / 180) * velocity;
			const vy = Math.sin((angle * Math.PI) / 180) * velocity;

			// Rotation
			const rotationSpeed = (Math.random() - 0.5) * 720;

			// Style
			piece.style.cssText = `
				position: absolute;
				width: ${size}px;
				height: ${shape === 'ribbon' ? size * 3 : size}px;
				background: ${color};
				border-radius: ${shape === 'circle' ? '50%' : shape === 'ribbon' ? '2px' : '0'};
				left: ${startX}px;
				top: ${startY}px;
				opacity: 1;
			`;

			this.confettiContainer.appendChild(piece);

			// Animate
			let x = startX;
			let y = startY;
			let currentVy = vy;
			let rotation = 0;
			let opacity = 1;
			const startTime = performance.now();

			const animate = (timestamp: number) => {
				const elapsed = timestamp - startTime;
				const progress = elapsed / duration;

				if (progress >= 1) {
					piece.remove();
					return;
				}

				// Update physics
				x += vx;
				currentVy += gravity * 0.5;
				y += currentVy;
				rotation += rotationSpeed * 0.016;

				// Fade out
				if (progress > 0.7) {
					opacity = 1 - (progress - 0.7) / 0.3;
				}

				// Apply
				piece.style.transform = `translate(${x - startX}px, ${y - startY}px) rotate(${rotation}deg)`;
				piece.style.opacity = opacity.toString();

				requestAnimationFrame(animate);
			};

			// Stagger start
			setTimeout(() => requestAnimationFrame(animate), i * 10);
		}

		// Clean up container after animation
		setTimeout(() => {
			if (this.confettiContainer) {
				this.confettiContainer.innerHTML = '';
			}
		}, duration + count * 10);
	}

	/**
	 * Show success/error banner
	 */
	showBanner(
		message: string,
		type: 'success' | 'error' | 'info' | 'warning' = 'success',
		duration: number = 2000
	): void {
		// Clear existing banner
		if (this.bannerTimeout) {
			clearTimeout(this.bannerTimeout);
		}

		const config: BannerConfig = {
			...defaultBannerConfig,
			message,
			type,
			duration
		};

		activeBanner.set(config);

		// Auto-hide
		this.bannerTimeout = setTimeout(() => {
			activeBanner.set(null);
		}, duration);
	}

	/**
	 * Hide current banner
	 */
	hideBanner(): void {
		if (this.bannerTimeout) {
			clearTimeout(this.bannerTimeout);
		}
		activeBanner.set(null);
	}

	/**
	 * Show screen edge vignette (for errors)
	 */
	showVignette(
		type: 'error' | 'warning' | 'success' = 'error',
		duration: number = 1000
	): void {
		// Clear existing vignette
		if (this.vignetteTimeout) {
			clearTimeout(this.vignetteTimeout);
		}

		const colors = {
			error: '#ef4444',
			warning: '#f59e0b',
			success: '#22c55e'
		};

		const config: VignetteConfig = {
			...defaultVignetteConfig,
			color: colors[type],
			duration
		};

		activeVignette.set(config);

		// Auto-hide
		this.vignetteTimeout = setTimeout(() => {
			activeVignette.set(null);
		}, duration);
	}

	/**
	 * Hide current vignette
	 */
	hideVignette(): void {
		if (this.vignetteTimeout) {
			clearTimeout(this.vignetteTimeout);
		}
		activeVignette.set(null);
	}

	/**
	 * Pipeline complete celebration
	 */
	pipelineComplete(): void {
		this.confetti({
			count: 150,
			colors: ['#22c55e', '#4ade80', '#86efac', '#3b82f6', '#f59e0b'],
			duration: 4000
		});
		this.showBanner('Pipeline Complete!', 'success', 3000);
	}

	/**
	 * Pipeline failed effect
	 */
	pipelineFailed(errorMessage?: string): void {
		this.showVignette('error', 1500);
		this.showBanner(errorMessage || 'Pipeline Failed', 'error', 4000);
	}

	/**
	 * Node completed celebration (smaller)
	 */
	nodeComplete(): void {
		// Smaller celebration for individual nodes
		this.confetti({
			count: 20,
			duration: 1000,
			spread: 40
		});
	}

	/**
	 * Achievement/milestone celebration
	 */
	achievement(message: string): void {
		this.confetti({
			count: 80,
			colors: ['#f59e0b', '#fbbf24', '#fcd34d'],
			duration: 2500
		});
		this.showBanner(message, 'info', 3000);
	}

	/**
	 * Cleanup
	 */
	destroy(): void {
		if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
		if (this.vignetteTimeout) clearTimeout(this.vignetteTimeout);

		activeBanner.set(null);
		activeVignette.set(null);

		if (this.confettiContainer) {
			this.confettiContainer.remove();
			this.confettiContainer = null;
		}
	}
}

// Export singleton instance
export const celebration = new Celebration();

// Export class for testing
export { Celebration };
