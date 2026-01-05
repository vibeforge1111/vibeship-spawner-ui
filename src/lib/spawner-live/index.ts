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

// Realtime
export {
	spawnerWebSocket,
	SpawnerWebSocket,
	mockEventSource,
	MockEventSource,
	type ConnectionStatus
} from './realtime';

// Execution
export {
	pipelineRunner,
	PipelineRunner,
	type ExecutionStatus,
	type ExecutionState,
	type ExecutionOptions,
	type ExecutionContext,
	type NodeResult
} from './execution';

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
export async function initSpawnerLive(options: {
	canvas?: HTMLCanvasElement;
	pipelineId?: string;
	nodeIds?: string[];
} = {}): Promise<void> {
	const { canvas, pipelineId, nodeIds } = options;

	// Import and initialize effects engine
	if (canvas) {
		const { effectsEngine: engine } = await import('./effects');
		engine.init(canvas);
	}

	// Import and initialize compliance tracking
	if (pipelineId && nodeIds) {
		const { complianceTracker: tracker } = await import('./enforcement');
		tracker.init(pipelineId, nodeIds);
	}

	console.log('[SpawnerLive] Initialized');
}

// Convenience cleanup function
export async function destroySpawnerLive(): Promise<void> {
	const [effectsMod, enforcementMod, orchestratorMod] = await Promise.all([
		import('./effects'),
		import('./enforcement'),
		import('./orchestrator')
	]);

	effectsMod.effectsEngine.destroy();
	enforcementMod.complianceTracker.destroy();
	orchestratorMod.eventRouter.clear();
	orchestratorMod.stateMachine.resetAll();
	orchestratorMod.eventBuffer.clear();

	console.log('[SpawnerLive] Destroyed');
}
