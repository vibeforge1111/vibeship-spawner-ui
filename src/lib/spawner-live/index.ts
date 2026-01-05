/**
 * Spawner Live - Real-Time Agent Orchestration Visualization
 *
 * Main module exports for the Spawner Live system.
 *
 * Usage:
 *
 * ```typescript
 * import { effectsEngine, eventRouter, complianceTracker } from '$lib/spawner-live';
 *
 * // Initialize the effects engine
 * effectsEngine.init(canvas);
 *
 * // Set up compliance tracking
 * complianceTracker.init(pipelineId, nodeIds);
 *
 * // Dispatch events (usually from WebSocket)
 * eventRouter.dispatch(event);
 * ```
 */

// Orchestrator
export {
	eventRouter,
	EventRouter,
	stateMachine,
	StateMachineManager,
	eventValidator,
	EventValidator,
	eventBuffer,
	EventBuffer
} from './orchestrator';

// Effects
export {
	effectsEngine,
	EffectsEngine,
	animationManager,
	AnimationManager,
	particleSystem,
	ParticleSystem,
	spotlightManager,
	SpotlightManager,
	connectionEffects,
	ConnectionEffects,
	celebration,
	Celebration,
	activeNodeAnimations,
	agentIndicators,
	progressRings,
	activeBanner,
	activeVignette
} from './effects';

// Enforcement
export { complianceTracker, ComplianceTracker } from './enforcement';

// Stores
export {
	liveModeStore,
	currentMode,
	currentPreset,
	isLiveEnabled,
	isPresentationMode,
	isDeveloperMode,
	effectsSettings,
	spotlightsEnabled,
	particlesEnabled,
	celebrationsEnabled
} from './stores';

// Types
export * from './types';

// Convenience initialization function
export function initSpawnerLive(options: {
	canvas?: HTMLCanvasElement;
	pipelineId?: string;
	nodeIds?: string[];
} = {}): void {
	const { canvas, pipelineId, nodeIds } = options;

	// Initialize effects engine
	if (canvas) {
		const { effectsEngine } = require('./effects');
		effectsEngine.init(canvas);
	}

	// Initialize compliance tracking
	if (pipelineId && nodeIds) {
		const { complianceTracker } = require('./enforcement');
		complianceTracker.init(pipelineId, nodeIds);
	}

	console.log('[SpawnerLive] Initialized');
}

// Convenience cleanup function
export function destroySpawnerLive(): void {
	const { effectsEngine } = require('./effects');
	const { complianceTracker } = require('./enforcement');
	const { eventRouter, stateMachine, eventBuffer } = require('./orchestrator');

	effectsEngine.destroy();
	complianceTracker.destroy();
	eventRouter.clear();
	stateMachine.resetAll();
	eventBuffer.clear();

	console.log('[SpawnerLive] Destroyed');
}
