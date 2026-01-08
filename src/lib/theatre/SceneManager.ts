/**
 * Theatre Scene Manager
 *
 * Handles Three.js scene setup, rendering, and cleanup.
 * Follows H70 threejs-3d-graphics patterns for memory management.
 */

import * as THREE from 'three';
import type { AgentCharacter, TheatreConfig } from './types';
import { ROLE_COLORS } from './types';

export class SceneManager {
	private container: HTMLElement;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;
	private renderer: THREE.WebGLRenderer;
	private clock: THREE.Clock;
	private animationId: number | null = null;
	private isRunning = false;

	// Characters
	private characterMeshes: Map<string, THREE.Group> = new Map();

	// Environment
	private gridHelper: THREE.GridHelper | null = null;
	private ambientLight: THREE.AmbientLight | null = null;
	private directionalLight: THREE.DirectionalLight | null = null;
	private particles: THREE.Points | null = null;

	// Config
	private config: TheatreConfig;

	// Resize handler bound reference
	private boundResize: () => void;

	constructor(container: HTMLElement, config: Partial<TheatreConfig> = {}) {
		this.container = container;
		this.config = {
			showGrid: true,
			showParticles: true,
			cameraMode: 'orbit',
			animationSpeed: 1,
			soundEnabled: false,
			...config
		};

		this.clock = new THREE.Clock();
		this.boundResize = this.resize.bind(this);

		// Initialize scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x0a0a0f);
		this.scene.fog = new THREE.Fog(0x0a0a0f, 10, 50);

		// Initialize camera
		this.camera = new THREE.PerspectiveCamera(
			60,
			container.clientWidth / container.clientHeight,
			0.1,
			1000
		);
		this.camera.position.set(0, 8, 12);
		this.camera.lookAt(0, 0, 3);

		// Initialize renderer with proper settings (H70 pattern)
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true,
			powerPreference: 'high-performance'
		});

		// CRITICAL: Cap pixel ratio (H70 anti-pattern avoidance)
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.setSize(container.clientWidth, container.clientHeight);
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.2;

		container.appendChild(this.renderer.domElement);

		// Setup resize handler
		window.addEventListener('resize', this.boundResize);

		// Handle WebGL context loss (H70 pattern)
		this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
			e.preventDefault();
			console.error('[Theatre] WebGL context lost');
			this.stop();
		});

		this.renderer.domElement.addEventListener('webglcontextrestored', () => {
			console.log('[Theatre] WebGL context restored');
			this.start();
		});

		// Setup environment
		this.setupLights();
		this.setupGrid();
		if (this.config.showParticles) {
			this.setupParticles();
		}
	}

	private setupLights(): void {
		// Ambient light
		this.ambientLight = new THREE.AmbientLight(0x404060, 0.4);
		this.scene.add(this.ambientLight);

		// Main directional light
		this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		this.directionalLight.position.set(5, 10, 5);
		this.scene.add(this.directionalLight);

		// Accent lights for cyberpunk feel
		const accentLight1 = new THREE.PointLight(0x00ffff, 0.5, 20);
		accentLight1.position.set(-5, 3, 0);
		this.scene.add(accentLight1);

		const accentLight2 = new THREE.PointLight(0xff00ff, 0.5, 20);
		accentLight2.position.set(5, 3, 0);
		this.scene.add(accentLight2);
	}

	private setupGrid(): void {
		if (!this.config.showGrid) return;

		this.gridHelper = new THREE.GridHelper(20, 20, 0x00ffff, 0x1a1a2e);
		this.gridHelper.position.y = -0.01;
		this.scene.add(this.gridHelper);
	}

	private setupParticles(): void {
		const particleCount = 500;
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);

		for (let i = 0; i < particleCount * 3; i += 3) {
			positions[i] = (Math.random() - 0.5) * 30;
			positions[i + 1] = Math.random() * 15;
			positions[i + 2] = (Math.random() - 0.5) * 30;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const material = new THREE.PointsMaterial({
			color: 0x00ffff,
			size: 0.05,
			transparent: true,
			opacity: 0.6
		});

		this.particles = new THREE.Points(geometry, material);
		this.scene.add(this.particles);
	}

	/**
	 * Create a character mesh for an agent
	 */
	createCharacter(character: AgentCharacter): THREE.Group {
		const group = new THREE.Group();
		group.name = character.id;

		const color = new THREE.Color(ROLE_COLORS[character.role] || ROLE_COLORS.general);

		// Body - stylized humanoid
		const bodyGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
		const bodyMaterial = new THREE.MeshStandardMaterial({
			color: color,
			metalness: 0.3,
			roughness: 0.7,
			emissive: color,
			emissiveIntensity: 0.2
		});
		const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
		body.position.y = 0.7;
		group.add(body);

		// Head - glowing sphere
		const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
		const headMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			emissive: color,
			emissiveIntensity: 0.5,
			metalness: 0.5,
			roughness: 0.3
		});
		const head = new THREE.Mesh(headGeometry, headMaterial);
		head.position.y = 1.4;
		group.add(head);

		// Status ring
		const ringGeometry = new THREE.RingGeometry(0.5, 0.55, 32);
		const ringMaterial = new THREE.MeshBasicMaterial({
			color: color,
			transparent: true,
			opacity: 0.8,
			side: THREE.DoubleSide
		});
		const ring = new THREE.Mesh(ringGeometry, ringMaterial);
		ring.rotation.x = -Math.PI / 2;
		ring.position.y = 0.01;
		ring.name = 'statusRing';
		group.add(ring);

		// Position
		group.position.set(
			character.position.x,
			character.position.y,
			character.position.z
		);

		// Store reference
		this.characterMeshes.set(character.id, group);
		this.scene.add(group);

		return group;
	}

	/**
	 * Update character appearance based on state
	 */
	updateCharacter(character: AgentCharacter): void {
		const group = this.characterMeshes.get(character.id);
		if (!group) return;

		// Update position with smooth interpolation
		group.position.lerp(
			new THREE.Vector3(character.position.x, character.position.y, character.position.z),
			0.1
		);

		// Update status ring color based on status
		const ring = group.getObjectByName('statusRing') as THREE.Mesh;
		if (ring && ring.material instanceof THREE.MeshBasicMaterial) {
			switch (character.status) {
				case 'working':
					ring.material.color.setHex(0x00ff00);
					break;
				case 'celebrating':
					ring.material.color.setHex(0xffd700);
					break;
				case 'error':
					ring.material.color.setHex(0xff0000);
					break;
				case 'blocked':
					ring.material.color.setHex(0xff6600);
					break;
				case 'handoff':
					ring.material.color.setHex(0x00ffff);
					break;
				default:
					ring.material.color.setHex(
						parseInt(ROLE_COLORS[character.role]?.slice(1) || '6B7280', 16)
					);
			}
		}

		// Animate based on status
		if (character.status === 'working') {
			group.rotation.y += 0.02 * this.config.animationSpeed;
		} else if (character.status === 'celebrating') {
			group.position.y = character.position.y + Math.sin(Date.now() * 0.01) * 0.2;
		}
	}

	/**
	 * Remove a character from the scene
	 */
	removeCharacter(characterId: string): void {
		const group = this.characterMeshes.get(characterId);
		if (group) {
			this.disposeGroup(group);
			this.scene.remove(group);
			this.characterMeshes.delete(characterId);
		}
	}

	/**
	 * Create handoff visualization between characters
	 */
	createHandoffBeam(fromId: string, toId: string): void {
		const fromGroup = this.characterMeshes.get(fromId);
		const toGroup = this.characterMeshes.get(toId);

		if (!fromGroup || !toGroup) return;

		const points = [
			new THREE.Vector3().copy(fromGroup.position).add(new THREE.Vector3(0, 1, 0)),
			new THREE.Vector3().copy(toGroup.position).add(new THREE.Vector3(0, 1, 0))
		];

		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial({
			color: 0x00ffff,
			transparent: true,
			opacity: 0.8
		});

		const line = new THREE.Line(geometry, material);
		line.name = `handoff-${fromId}-${toId}`;
		this.scene.add(line);

		// Auto-remove after animation
		setTimeout(() => {
			this.scene.remove(line);
			geometry.dispose();
			material.dispose();
		}, 2000);
	}

	/**
	 * Resize handler
	 */
	private resize(): void {
		const width = this.container.clientWidth;
		const height = this.container.clientHeight;

		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}

	/**
	 * Animation loop
	 */
	private animate(): void {
		if (!this.isRunning) return;

		this.animationId = requestAnimationFrame(() => this.animate());

		const delta = this.clock.getDelta();

		// Animate particles
		if (this.particles) {
			this.particles.rotation.y += 0.0005 * this.config.animationSpeed;
		}

		// Render
		this.renderer.render(this.scene, this.camera);
	}

	/**
	 * Start the animation loop
	 */
	start(): void {
		if (this.isRunning) return;
		this.isRunning = true;
		this.clock.start();
		this.animate();
	}

	/**
	 * Stop the animation loop
	 */
	stop(): void {
		this.isRunning = false;
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
	}

	/**
	 * Dispose of a group and its resources (H70 pattern)
	 */
	private disposeGroup(group: THREE.Group): void {
		group.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry?.dispose();
				if (object.material instanceof THREE.Material) {
					this.disposeMaterial(object.material);
				} else if (Array.isArray(object.material)) {
					object.material.forEach((m) => this.disposeMaterial(m));
				}
			}
		});
	}

	/**
	 * Dispose of material and its textures
	 */
	private disposeMaterial(material: THREE.Material): void {
		const mat = material as THREE.MeshStandardMaterial;
		mat.map?.dispose();
		mat.normalMap?.dispose();
		mat.roughnessMap?.dispose();
		mat.metalnessMap?.dispose();
		mat.emissiveMap?.dispose();
		material.dispose();
	}

	/**
	 * Full cleanup (H70 pattern)
	 */
	dispose(): void {
		this.stop();

		// Remove event listeners
		window.removeEventListener('resize', this.boundResize);

		// Dispose all characters
		for (const [id] of this.characterMeshes) {
			this.removeCharacter(id);
		}

		// Dispose environment
		if (this.gridHelper) {
			this.gridHelper.geometry.dispose();
			(this.gridHelper.material as THREE.Material).dispose();
			this.scene.remove(this.gridHelper);
		}

		if (this.particles) {
			this.particles.geometry.dispose();
			(this.particles.material as THREE.Material).dispose();
			this.scene.remove(this.particles);
		}

		// Dispose renderer
		this.renderer.dispose();

		// Remove canvas
		if (this.renderer.domElement.parentElement) {
			this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
		}
	}

	/**
	 * Get camera for external controls
	 */
	getCamera(): THREE.PerspectiveCamera {
		return this.camera;
	}

	/**
	 * Get renderer DOM element
	 */
	getDomElement(): HTMLCanvasElement {
		return this.renderer.domElement;
	}

	/**
	 * Update config
	 */
	updateConfig(config: Partial<TheatreConfig>): void {
		this.config = { ...this.config, ...config };

		if (this.gridHelper) {
			this.gridHelper.visible = this.config.showGrid;
		}

		if (this.particles) {
			this.particles.visible = this.config.showParticles;
		}
	}
}
