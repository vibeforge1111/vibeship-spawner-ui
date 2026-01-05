/**
 * Spawner Live - Animation Types
 * Animation configuration and effect definitions
 */

// Animation easing functions
export type EasingFunction =
	| 'linear'
	| 'ease'
	| 'ease-in'
	| 'ease-out'
	| 'ease-in-out'
	| 'spring'
	| 'bounce';

// Base animation config
export interface AnimationConfig {
	duration: number; // milliseconds
	easing: EasingFunction;
	delay?: number;
}

// Node scale animation
export interface ScaleAnimation extends AnimationConfig {
	scale: number;
}

// Node shake animation (for errors)
export interface ShakeAnimation extends AnimationConfig {
	intensity: number; // pixels
	cycles: number;
}

// Node pulse animation
export interface PulseAnimation extends AnimationConfig {
	color: string;
	intensity: number; // 0-1
}

// Progress ring configuration
export interface ProgressRingConfig {
	radius: number;
	strokeWidth: number;
	color: string;
	backgroundColor: string;
	animationDuration: number;
}

// Particle configuration
export interface ParticleConfig {
	count: number;
	color: string | string[]; // Single color or array for variety
	size: { min: number; max: number };
	speed: { min: number; max: number };
	lifetime: number; // milliseconds
	spread: number; // degrees (0-360)
	direction?: number; // degrees, default is outward from center
	gravity?: number;
	fade?: boolean;
	shrink?: boolean;
}

// Particle burst effect
export interface ParticleBurstConfig extends ParticleConfig {
	origin: { x: number; y: number };
}

// Spotlight configuration
export interface SpotlightConfig {
	color: string;
	intensity: number; // 0-1
	radius: number;
	blur: number;
	pulseSpeed?: number; // milliseconds per cycle
}

// Connection pulse configuration
export interface ConnectionPulseConfig {
	color: string;
	width: number;
	speed: number; // pixels per second
	glow: boolean;
	glowIntensity?: number;
}

// Traveling pulse along connection
export interface TravelingPulseConfig {
	duration: number;
	color: string;
	size: number;
	trail?: boolean;
	trailLength?: number;
}

// Confetti configuration
export interface ConfettiConfig {
	count: number;
	colors: string[];
	duration: number;
	spread: number;
	origin: { x: number; y: number }; // 0-1 relative to viewport
	gravity: number;
	shapes: ('square' | 'circle' | 'ribbon')[];
}

// Banner configuration
export interface BannerConfig {
	message: string;
	type: 'success' | 'error' | 'info' | 'warning';
	duration: number;
	position: 'top' | 'center' | 'bottom';
	animation: 'slide' | 'fade' | 'bounce';
}

// Vignette configuration (screen edge effect)
export interface VignetteConfig {
	color: string;
	intensity: number; // 0-1
	duration: number;
	animation: 'pulse' | 'fade-in-out' | 'static';
}

// Agent indicator (glowing orb)
export interface AgentIndicatorConfig {
	color: string;
	size: number;
	pulseSpeed: number;
	glow: boolean;
	glowColor?: string;
	glowIntensity?: number;
}

// Complete effects settings
export interface EffectsSettings {
	enabled: boolean;
	mode: 'presentation' | 'developer';
	preset: 'minimal' | 'balanced' | 'maximum';
	reducedMotion: boolean;

	// Individual effect toggles and configs
	spotlights: {
		enabled: boolean;
		color: string;
		intensity: number;
	};

	particles: {
		enabled: boolean;
		color: string;
		maxCount: number;
	};

	indicators: {
		enabled: boolean;
		color: string;
		size: number;
	};

	completionBurst: {
		enabled: boolean;
		particleCount: number;
		duration: number;
	};

	errorShake: {
		enabled: boolean;
		intensity: number;
	};

	handoffSpotlight: {
		enabled: boolean;
		duration: number;
		pulseSpeed: number;
		color: string;
	};

	milestone: {
		enabled: boolean;
		confettiCount: number;
		duration: number;
		sound: boolean;
	};

	progressRing: {
		enabled: boolean;
		color: string;
		size: number;
	};
}

// Default effects settings
export const defaultEffectsSettings: EffectsSettings = {
	enabled: true,
	mode: 'presentation',
	preset: 'balanced',
	reducedMotion: false,

	spotlights: {
		enabled: true,
		color: '#3b82f6',
		intensity: 0.6
	},

	particles: {
		enabled: true,
		color: '#22c55e',
		maxCount: 100
	},

	indicators: {
		enabled: true,
		color: '#8b5cf6',
		size: 12
	},

	completionBurst: {
		enabled: true,
		particleCount: 30,
		duration: 500
	},

	errorShake: {
		enabled: true,
		intensity: 5
	},

	handoffSpotlight: {
		enabled: true,
		duration: 800,
		pulseSpeed: 400,
		color: '#f59e0b'
	},

	milestone: {
		enabled: true,
		confettiCount: 100,
		duration: 3000,
		sound: false
	},

	progressRing: {
		enabled: true,
		color: '#3b82f6',
		size: 40
	}
};

// Preset configurations
export const effectsPresets: Record<string, Partial<EffectsSettings>> = {
	minimal: {
		spotlights: { enabled: true, color: '#3b82f6', intensity: 0.3 },
		particles: { enabled: false, color: '#22c55e', maxCount: 0 },
		indicators: { enabled: true, color: '#8b5cf6', size: 8 },
		completionBurst: { enabled: false, particleCount: 0, duration: 0 },
		errorShake: { enabled: true, intensity: 3 },
		handoffSpotlight: { enabled: true, duration: 400, pulseSpeed: 200, color: '#f59e0b' },
		milestone: { enabled: false, confettiCount: 0, duration: 0, sound: false },
		progressRing: { enabled: true, color: '#3b82f6', size: 30 }
	},
	balanced: defaultEffectsSettings,
	maximum: {
		spotlights: { enabled: true, color: '#3b82f6', intensity: 0.8 },
		particles: { enabled: true, color: '#22c55e', maxCount: 200 },
		indicators: { enabled: true, color: '#8b5cf6', size: 16 },
		completionBurst: { enabled: true, particleCount: 50, duration: 700 },
		errorShake: { enabled: true, intensity: 8 },
		handoffSpotlight: { enabled: true, duration: 1000, pulseSpeed: 500, color: '#f59e0b' },
		milestone: { enabled: true, confettiCount: 200, duration: 5000, sound: true },
		progressRing: { enabled: true, color: '#3b82f6', size: 50 }
	}
};
