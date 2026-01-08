/**
 * Particle Effects System
 *
 * Task 7: Engagement - Turn automation into entertainment
 * Creates visual particle effects for celebrations, handoffs, and progress.
 */

import * as THREE from 'three';

export interface ParticleConfig {
	count: number;
	size: number;
	color: THREE.Color | string;
	lifetime: number;
	spread: number;
	speed: number;
}

export class ParticleSystem {
	private scene: THREE.Scene;
	private particles: THREE.Points[] = [];
	private animationCallbacks: Map<string, (delta: number) => boolean> = new Map();

	constructor(scene: THREE.Scene) {
		this.scene = scene;
	}

	/**
	 * Create celebration burst effect
	 */
	celebrationBurst(position: THREE.Vector3, color: string = '#ffd700'): void {
		const count = 50;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);
		const velocities = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);

		const baseColor = new THREE.Color(color);

		for (let i = 0; i < count; i++) {
			const i3 = i * 3;

			// Start at position
			positions[i3] = position.x;
			positions[i3 + 1] = position.y + 1;
			positions[i3 + 2] = position.z;

			// Random velocity outward
			const angle = Math.random() * Math.PI * 2;
			const speed = 2 + Math.random() * 3;
			velocities[i3] = Math.cos(angle) * speed;
			velocities[i3 + 1] = 3 + Math.random() * 2;
			velocities[i3 + 2] = Math.sin(angle) * speed;

			// Slight color variation
			const hslColor = { h: 0, s: 0, l: 0 };
			baseColor.getHSL(hslColor);
			const variedColor = new THREE.Color().setHSL(
				hslColor.h + (Math.random() - 0.5) * 0.1,
				hslColor.s,
				hslColor.l + (Math.random() - 0.5) * 0.2
			);
			colors[i3] = variedColor.r;
			colors[i3 + 1] = variedColor.g;
			colors[i3 + 2] = variedColor.b;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

		const material = new THREE.PointsMaterial({
			size: 0.1,
			vertexColors: true,
			transparent: true,
			opacity: 1
		});

		const points = new THREE.Points(geometry, material);
		this.scene.add(points);
		this.particles.push(points);

		// Animation
		const startTime = Date.now();
		const duration = 2000;
		const id = `celebration-${startTime}`;

		this.animationCallbacks.set(id, (delta) => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;

			if (progress >= 1) {
				this.removeParticle(points);
				return false;
			}

			const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
			const posArray = posAttr.array as Float32Array;

			for (let i = 0; i < count; i++) {
				const i3 = i * 3;
				posArray[i3] += velocities[i3] * delta;
				posArray[i3 + 1] += velocities[i3 + 1] * delta - 9.8 * delta * delta; // Gravity
				posArray[i3 + 2] += velocities[i3 + 2] * delta;

				// Slow down velocity
				velocities[i3] *= 0.99;
				velocities[i3 + 2] *= 0.99;
			}

			posAttr.needsUpdate = true;
			material.opacity = 1 - progress;

			return true;
		});
	}

	/**
	 * Create handoff beam effect
	 */
	handoffBeam(from: THREE.Vector3, to: THREE.Vector3, color: string = '#00ffff'): void {
		const count = 20;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);

		const direction = new THREE.Vector3().subVectors(to, from);
		const length = direction.length();
		direction.normalize();

		for (let i = 0; i < count; i++) {
			const i3 = i * 3;
			positions[i3] = from.x;
			positions[i3 + 1] = from.y + 1;
			positions[i3 + 2] = from.z;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const material = new THREE.PointsMaterial({
			size: 0.15,
			color: new THREE.Color(color),
			transparent: true,
			opacity: 1
		});

		const points = new THREE.Points(geometry, material);
		this.scene.add(points);
		this.particles.push(points);

		// Animation - particles travel along beam
		const startTime = Date.now();
		const duration = 1500;
		const id = `handoff-${startTime}`;

		this.animationCallbacks.set(id, () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;

			if (progress >= 1) {
				this.removeParticle(points);
				return false;
			}

			const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
			const posArray = posAttr.array as Float32Array;

			for (let i = 0; i < count; i++) {
				const i3 = i * 3;
				const particleProgress = (progress * 2 + i / count) % 1;

				posArray[i3] = from.x + direction.x * length * particleProgress;
				posArray[i3 + 1] = from.y + 1 + direction.y * length * particleProgress + Math.sin(particleProgress * Math.PI) * 0.5;
				posArray[i3 + 2] = from.z + direction.z * length * particleProgress;
			}

			posAttr.needsUpdate = true;
			material.opacity = 1 - progress * 0.5;

			return true;
		});
	}

	/**
	 * Create progress ring effect
	 */
	progressRing(position: THREE.Vector3, progress: number, color: string = '#00ffff'): void {
		const segments = 32;
		const radius = 0.6;
		const filledSegments = Math.floor(segments * (progress / 100));

		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(filledSegments * 3);

		for (let i = 0; i < filledSegments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			const i3 = i * 3;
			positions[i3] = position.x + Math.cos(angle) * radius;
			positions[i3 + 1] = position.y + 0.05;
			positions[i3 + 2] = position.z + Math.sin(angle) * radius;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const material = new THREE.PointsMaterial({
			size: 0.08,
			color: new THREE.Color(color),
			transparent: true,
			opacity: 0.8
		});

		const points = new THREE.Points(geometry, material);
		points.name = `progress-ring-${position.x}-${position.z}`;

		// Remove existing ring at this position
		const existing = this.scene.getObjectByName(points.name);
		if (existing) {
			this.scene.remove(existing);
			(existing as THREE.Points).geometry.dispose();
			((existing as THREE.Points).material as THREE.Material).dispose();
		}

		this.scene.add(points);
	}

	/**
	 * Create error flash effect
	 */
	errorFlash(position: THREE.Vector3): void {
		const count = 30;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			const i3 = i * 3;
			const angle = (i / count) * Math.PI * 2;
			const radius = 0.3 + Math.random() * 0.3;
			positions[i3] = position.x + Math.cos(angle) * radius;
			positions[i3 + 1] = position.y + 0.5 + Math.random() * 1;
			positions[i3 + 2] = position.z + Math.sin(angle) * radius;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const material = new THREE.PointsMaterial({
			size: 0.12,
			color: new THREE.Color('#ff0000'),
			transparent: true,
			opacity: 1
		});

		const points = new THREE.Points(geometry, material);
		this.scene.add(points);
		this.particles.push(points);

		// Flash animation
		const startTime = Date.now();
		const duration = 1000;
		const id = `error-${startTime}`;

		this.animationCallbacks.set(id, () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;

			if (progress >= 1) {
				this.removeParticle(points);
				return false;
			}

			// Pulsing flash
			material.opacity = Math.abs(Math.sin(progress * Math.PI * 4)) * (1 - progress);

			return true;
		});
	}

	/**
	 * Create ambient floating particles
	 */
	createAmbientParticles(): THREE.Points {
		const count = 200;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 3);

		for (let i = 0; i < count * 3; i += 3) {
			positions[i] = (Math.random() - 0.5) * 20;
			positions[i + 1] = Math.random() * 10;
			positions[i + 2] = (Math.random() - 0.5) * 20;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const material = new THREE.PointsMaterial({
			size: 0.03,
			color: new THREE.Color('#00ffff'),
			transparent: true,
			opacity: 0.4
		});

		const points = new THREE.Points(geometry, material);
		points.name = 'ambient-particles';
		this.scene.add(points);

		// Floating animation
		const id = 'ambient';
		this.animationCallbacks.set(id, (delta) => {
			points.rotation.y += 0.0002;

			const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
			const posArray = posAttr.array as Float32Array;

			for (let i = 0; i < count * 3; i += 3) {
				posArray[i + 1] += Math.sin(Date.now() * 0.001 + posArray[i]) * 0.001;
			}
			posAttr.needsUpdate = true;

			return true;
		});

		return points;
	}

	/**
	 * Update all particle animations
	 */
	update(delta: number): void {
		const toRemove: string[] = [];

		this.animationCallbacks.forEach((callback, id) => {
			const continueAnimation = callback(delta);
			if (!continueAnimation) {
				toRemove.push(id);
			}
		});

		toRemove.forEach((id) => this.animationCallbacks.delete(id));
	}

	/**
	 * Remove a particle system
	 */
	private removeParticle(points: THREE.Points): void {
		this.scene.remove(points);
		points.geometry.dispose();
		(points.material as THREE.Material).dispose();

		const index = this.particles.indexOf(points);
		if (index > -1) {
			this.particles.splice(index, 1);
		}
	}

	/**
	 * Dispose all particles
	 */
	dispose(): void {
		this.animationCallbacks.clear();

		for (const points of this.particles) {
			this.scene.remove(points);
			points.geometry.dispose();
			(points.material as THREE.Material).dispose();
		}

		this.particles = [];

		// Remove ambient particles
		const ambient = this.scene.getObjectByName('ambient-particles');
		if (ambient) {
			this.scene.remove(ambient);
			(ambient as THREE.Points).geometry.dispose();
			((ambient as THREE.Points).material as THREE.Material).dispose();
		}
	}
}
