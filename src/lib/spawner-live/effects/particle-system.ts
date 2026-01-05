/**
 * Spawner Live - Particle System
 * Canvas-based particle effects for celebrations and activity indication
 */

import { writable } from 'svelte/store';
import type { ParticleConfig, ParticleBurstConfig } from '../types/animation';

// Particle class
interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number;
	color: string;
	lifetime: number;
	maxLifetime: number;
	opacity: number;
	active: boolean;
}

// Configuration
const MAX_PARTICLES = 500;
const DEFAULT_GRAVITY = 0.1;

class ParticleSystem {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private particles: Particle[] = [];
	private pool: Particle[] = [];
	private animationFrame: number | null = null;
	private isRunning = false;
	private lastTime = 0;
	private initialized = false;

	// Performance tracking
	public particleCount = writable<number>(0);
	public fps = writable<number>(60);

	/**
	 * Initialize with a canvas element
	 */
	init(canvas: HTMLCanvasElement): void {
		// Prevent double initialization
		if (this.initialized) {
			console.log('[ParticleSystem] Already initialized');
			return;
		}

		this.canvas = canvas;
		this.ctx = canvas.getContext('2d');

		// Pre-populate pool
		for (let i = 0; i < MAX_PARTICLES; i++) {
			this.pool.push(this.createParticle());
		}

		// Handle resize (only in browser)
		if (typeof window !== 'undefined') {
			this.handleResize();
			window.addEventListener('resize', () => this.handleResize());
		}

		this.initialized = true;
		console.log('[ParticleSystem] Initialized');
	}

	/**
	 * Handle canvas resize
	 */
	private handleResize(): void {
		if (!this.canvas || typeof window === 'undefined') return;
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
	}

	/**
	 * Create a particle object
	 */
	private createParticle(): Particle {
		return {
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			size: 5,
			color: '#ffffff',
			lifetime: 0,
			maxLifetime: 1000,
			opacity: 1,
			active: false
		};
	}

	/**
	 * Acquire a particle from the pool
	 */
	private acquireParticle(): Particle | null {
		if (this.particles.length >= MAX_PARTICLES) {
			// Recycle oldest particle
			const oldest = this.particles.shift();
			if (oldest) {
				oldest.active = false;
				return oldest;
			}
			return null;
		}

		const particle = this.pool.pop() || this.createParticle();
		this.particles.push(particle);
		return particle;
	}

	/**
	 * Release a particle back to the pool
	 */
	private releaseParticle(particle: Particle): void {
		particle.active = false;
		const index = this.particles.indexOf(particle);
		if (index >= 0) {
			this.particles.splice(index, 1);
		}
		this.pool.push(particle);
	}

	/**
	 * Emit particles from a node
	 */
	emit(nodeId: string, config: Partial<ParticleConfig> = {}): void {
		const element = document.querySelector(`[data-node-id="${nodeId}"]`);
		if (!element) return;

		const rect = element.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		this.emitAt(centerX, centerY, config);
	}

	/**
	 * Emit particles at a specific position
	 */
	emitAt(x: number, y: number, config: Partial<ParticleConfig> = {}): void {
		const {
			count = 10,
			color = '#22c55e',
			size = { min: 3, max: 8 },
			speed = { min: 2, max: 5 },
			lifetime = 1000,
			spread = 360,
			direction = 0,
			gravity = 0,
			fade = true,
			shrink = true
		} = config;

		const colors = Array.isArray(color) ? color : [color];

		for (let i = 0; i < count; i++) {
			const particle = this.acquireParticle();
			if (!particle) break;

			// Random angle within spread
			const angle = ((direction - spread / 2 + Math.random() * spread) * Math.PI) / 180;
			const velocity = speed.min + Math.random() * (speed.max - speed.min);

			particle.x = x;
			particle.y = y;
			particle.vx = Math.cos(angle) * velocity;
			particle.vy = Math.sin(angle) * velocity;
			particle.size = size.min + Math.random() * (size.max - size.min);
			particle.color = colors[Math.floor(Math.random() * colors.length)];
			particle.lifetime = 0;
			particle.maxLifetime = lifetime;
			particle.opacity = 1;
			particle.active = true;
		}

		this.particleCount.set(this.particles.length);

		if (!this.isRunning) {
			this.start();
		}
	}

	/**
	 * Burst particles outward from a node (for completion)
	 */
	burst(nodeId: string, config: Partial<ParticleBurstConfig> = {}): void {
		const element = document.querySelector(`[data-node-id="${nodeId}"]`);
		if (!element) return;

		const rect = element.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		this.emitAt(centerX, centerY, {
			count: config.count || 30,
			color: config.color || ['#22c55e', '#4ade80', '#86efac'],
			size: config.size || { min: 4, max: 10 },
			speed: config.speed || { min: 3, max: 8 },
			lifetime: config.lifetime || 800,
			spread: 360,
			gravity: 0.15,
			fade: true,
			shrink: true
		});
	}

	/**
	 * Create a trail effect (particles following a path)
	 */
	trail(
		fromX: number,
		fromY: number,
		toX: number,
		toY: number,
		config: Partial<ParticleConfig> = {}
	): void {
		const distance = Math.sqrt(Math.pow(toX - fromX, 2) + Math.pow(toY - fromY, 2));
		const steps = Math.floor(distance / 20);
		const dx = (toX - fromX) / steps;
		const dy = (toY - fromY) / steps;

		for (let i = 0; i < steps; i++) {
			setTimeout(() => {
				this.emitAt(fromX + dx * i, fromY + dy * i, {
					count: 3,
					color: config.color || '#f59e0b',
					size: { min: 2, max: 4 },
					speed: { min: 0.5, max: 1.5 },
					lifetime: 500,
					spread: 60,
					direction: (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI,
					fade: true
				});
			}, i * 30);
		}
	}

	/**
	 * Start the animation loop
	 */
	private start(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		this.lastTime = performance.now();
		this.animate();
	}

	/**
	 * Stop the animation loop
	 */
	stop(): void {
		this.isRunning = false;
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
	}

	/**
	 * Main animation loop
	 */
	private animate = (): void => {
		if (!this.isRunning || !this.ctx || !this.canvas) return;

		const now = performance.now();
		const delta = now - this.lastTime;
		this.lastTime = now;

		// Update FPS
		this.fps.set(Math.round(1000 / delta));

		// Clear canvas
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		// Update and draw particles
		const toRemove: Particle[] = [];

		for (const particle of this.particles) {
			if (!particle.active) continue;

			// Update lifetime
			particle.lifetime += delta;
			if (particle.lifetime >= particle.maxLifetime) {
				toRemove.push(particle);
				continue;
			}

			// Update position
			particle.x += particle.vx;
			particle.y += particle.vy;

			// Apply gravity
			particle.vy += DEFAULT_GRAVITY;

			// Update opacity (fade out)
			particle.opacity = 1 - particle.lifetime / particle.maxLifetime;

			// Update size (shrink)
			const sizeRatio = 1 - particle.lifetime / particle.maxLifetime;

			// Draw particle
			this.ctx.beginPath();
			this.ctx.arc(particle.x, particle.y, particle.size * sizeRatio, 0, Math.PI * 2);
			this.ctx.fillStyle = this.hexToRgba(particle.color, particle.opacity);
			this.ctx.fill();
		}

		// Remove dead particles
		toRemove.forEach((p) => this.releaseParticle(p));

		this.particleCount.set(this.particles.length);

		// Continue loop or stop if no particles
		if (this.particles.length > 0) {
			this.animationFrame = requestAnimationFrame(this.animate);
		} else {
			this.isRunning = false;
		}
	};

	/**
	 * Convert hex color to rgba
	 */
	private hexToRgba(hex: string, alpha: number): string {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (!result) return `rgba(255, 255, 255, ${alpha})`;

		const r = parseInt(result[1], 16);
		const g = parseInt(result[2], 16);
		const b = parseInt(result[3], 16);

		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	}

	/**
	 * Clear all particles
	 */
	clear(): void {
		this.particles.forEach((p) => {
			p.active = false;
			this.pool.push(p);
		});
		this.particles = [];
		this.particleCount.set(0);

		if (this.ctx && this.canvas) {
			this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		}
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.stop();
		this.clear();
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', () => this.handleResize());
		}
		this.canvas = null;
		this.ctx = null;
		this.pool = [];
		this.initialized = false;
		console.log('[ParticleSystem] Destroyed');
	}

	/**
	 * Check if initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}
}

// Export singleton instance
export const particleSystem = new ParticleSystem();

// Export class for testing
export { ParticleSystem };
