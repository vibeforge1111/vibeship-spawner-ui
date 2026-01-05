/**
 * Spawner Live - Effects Engine
 * Main coordinator for all visual effects based on agent events
 */

import { get } from 'svelte/store';
import { eventRouter } from '../orchestrator/event-router';
import { stateMachine } from '../orchestrator/state-machine';
import { animationManager } from './animation-manager';
import { particleSystem } from './particle-system';
import { spotlightManager } from './spotlight-manager';
import { connectionEffects } from './connection-effects';
import { celebration } from './celebration';
import type { AgentEvent } from '../types/events';
import type { EffectsSettings } from '../types/animation';
import { defaultEffectsSettings } from '../types/animation';

// Settings store (to be imported from stores in real usage)
let currentSettings: EffectsSettings = defaultEffectsSettings;

class EffectsEngine {
	private unsubscribe: (() => void) | null = null;
	private initialized = false;
	private reducedMotion = false;

	/**
	 * Initialize the effects engine
	 */
	init(canvas?: HTMLCanvasElement): void {
		if (this.initialized) return;

		// Only run in browser environment
		if (typeof window === 'undefined') {
			console.warn('[EffectsEngine] Cannot initialize in SSR environment');
			return;
		}

		// Check for reduced motion preference
		this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Initialize particle system if canvas provided
		if (canvas) {
			particleSystem.init(canvas);
		}

		// Initialize celebration system
		celebration.init();

		// Subscribe to all events
		this.unsubscribe = eventRouter.subscribe({
			id: 'effects-engine',
			callback: (event) => this.handleEvent(event)
		});

		this.initialized = true;
		console.log('[EffectsEngine] Initialized');
	}

	/**
	 * Update settings
	 */
	updateSettings(settings: Partial<EffectsSettings>): void {
		currentSettings = { ...currentSettings, ...settings };
	}

	/**
	 * Get current settings
	 */
	getSettings(): EffectsSettings {
		return { ...currentSettings };
	}

	/**
	 * Handle incoming events
	 */
	private handleEvent(event: AgentEvent): void {
		// Skip if effects disabled or reduced motion
		if (!currentSettings.enabled) return;
		if (this.reducedMotion && currentSettings.reducedMotion) return;

		// Process state machine first
		if (event.nodeId) {
			stateMachine.processEvent(event);
		}

		// Trigger appropriate effects
		switch (event.type) {
			case 'agent_enter':
				this.onAgentEnter(event);
				break;
			case 'agent_progress':
				this.onAgentProgress(event);
				break;
			case 'agent_thinking':
				this.onAgentThinking(event);
				break;
			case 'agent_output':
				this.onAgentOutput(event);
				break;
			case 'agent_exit':
				this.onAgentExit(event);
				break;
			case 'agent_error':
				this.onAgentError(event);
				break;
			case 'agent_skip':
				this.onAgentSkip(event);
				break;
			case 'handoff_start':
				this.onHandoffStart(event);
				break;
			case 'handoff_complete':
				this.onHandoffComplete(event);
				break;
			case 'pipeline_start':
				this.onPipelineStart(event);
				break;
			case 'pipeline_complete':
				this.onPipelineComplete(event);
				break;
			case 'pipeline_failed':
				this.onPipelineFailed(event);
				break;
			case 'deviation_warn':
				this.onDeviationWarn(event);
				break;
		}
	}

	/**
	 * Agent enters a node
	 */
	private onAgentEnter(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Spotlight effect
		if (currentSettings.spotlights.enabled) {
			spotlightManager.activate(event.nodeId, {
				color: currentSettings.spotlights.color,
				intensity: currentSettings.spotlights.intensity
			});
		}

		// Agent indicator (glowing orb)
		if (currentSettings.indicators.enabled) {
			animationManager.showAgentIndicator(
				event.nodeId,
				event.agentId,
				currentSettings.indicators.color
			);
		}

		// Scale up animation
		animationManager.scaleNode(event.nodeId, 1.1, 300);

		// Initialize progress ring
		if (currentSettings.progressRing.enabled) {
			animationManager.updateProgressRing(event.nodeId, 0);
		}
	}

	/**
	 * Agent progress update
	 */
	private onAgentProgress(event: AgentEvent): void {
		if (!event.nodeId) return;

		const progress = (event.data?.progress as number) || 0;

		// Update progress ring
		if (currentSettings.progressRing.enabled) {
			animationManager.updateProgressRing(event.nodeId, progress);
		}

		// Subtle particles during processing
		if (currentSettings.particles.enabled && progress % 25 === 0 && progress > 0) {
			particleSystem.emit(event.nodeId, {
				count: 5,
				color: currentSettings.particles.color,
				lifetime: 400,
				size: { min: 2, max: 4 },
				speed: { min: 1, max: 3 }
			});
		}
	}

	/**
	 * Agent is thinking
	 */
	private onAgentThinking(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Pulsing effect while thinking
		animationManager.pulseNode(event.nodeId, currentSettings.spotlights.color, 1000);
	}

	/**
	 * Agent produced output
	 */
	private onAgentOutput(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Brief highlight
		animationManager.highlightNode(event.nodeId, '#22c55e', 500);
	}

	/**
	 * Agent exits node (success)
	 */
	private onAgentExit(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Remove spotlight
		spotlightManager.deactivate(event.nodeId);

		// Success burst - disabled for minimal style
		// if (currentSettings.completionBurst.enabled) {
		// 	particleSystem.burst(event.nodeId, {
		// 		count: currentSettings.completionBurst.particleCount,
		// 		lifetime: currentSettings.completionBurst.duration,
		// 		color: ['#22c55e', '#4ade80', '#86efac']
		// 	});
		// }

		// Reset scale
		animationManager.scaleNode(event.nodeId, 1.0, 200);

		// Hide agent indicator
		animationManager.hideAgentIndicator(event.nodeId);

		// Clear progress ring
		animationManager.clearProgressRing(event.nodeId);

		// Success pulse
		animationManager.pulseNode(event.nodeId, '#22c55e', 400);
	}

	/**
	 * Agent error
	 */
	private onAgentError(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Shake animation
		if (currentSettings.errorShake.enabled) {
			animationManager.shakeNode(event.nodeId, {
				intensity: currentSettings.errorShake.intensity,
				cycles: 3
			});
		}

		// Red pulse
		animationManager.pulseNode(event.nodeId, '#ef4444', 600);

		// Remove spotlight
		spotlightManager.deactivate(event.nodeId);

		// Hide agent indicator
		animationManager.hideAgentIndicator(event.nodeId);

		// Clear progress ring
		animationManager.clearProgressRing(event.nodeId);

		// Error particles - disabled for minimal style
		// if (currentSettings.particles.enabled) {
		// 	particleSystem.burst(event.nodeId, {
		// 		count: 15,
		// 		color: ['#ef4444', '#f87171'],
		// 		lifetime: 500
		// 	});
		// }
	}

	/**
	 * Agent skipped node
	 */
	private onAgentSkip(event: AgentEvent): void {
		if (!event.nodeId) return;

		// Fade out effect
		animationManager.fadeNode(event.nodeId, 0.5, 300);

		// Remove any spotlight
		spotlightManager.deactivate(event.nodeId);
	}

	/**
	 * Handoff started
	 */
	private onHandoffStart(event: AgentEvent): void {
		if (!event.nodeId || !event.data?.targetNodeId) return;

		const targetNodeId = event.data.targetNodeId as string;

		// Connection spotlight
		if (currentSettings.handoffSpotlight.enabled) {
			connectionEffects.spotlight(event.nodeId, targetNodeId, {
				duration: currentSettings.handoffSpotlight.duration,
				color: currentSettings.handoffSpotlight.color,
				intensity: 0.8
			});

			// Traveling pulse
			connectionEffects.travelingPulse(event.nodeId, targetNodeId, {
				duration: currentSettings.handoffSpotlight.pulseSpeed,
				color: currentSettings.handoffSpotlight.color,
				size: 10
			});
		}

		// Particle trail
		if (currentSettings.particles.enabled) {
			const sourceEl = document.querySelector(`[data-node-id="${event.nodeId}"]`);
			const targetEl = document.querySelector(`[data-node-id="${targetNodeId}"]`);

			if (sourceEl && targetEl) {
				const sourceRect = sourceEl.getBoundingClientRect();
				const targetRect = targetEl.getBoundingClientRect();

				particleSystem.trail(
					sourceRect.left + sourceRect.width / 2,
					sourceRect.top + sourceRect.height / 2,
					targetRect.left + targetRect.width / 2,
					targetRect.top + targetRect.height / 2,
					{
						color: currentSettings.handoffSpotlight.color
					}
				);
			}
		}
	}

	/**
	 * Handoff completed
	 */
	private onHandoffComplete(event: AgentEvent): void {
		// Connection returns to normal
		if (event.data?.sourceNodeId && event.nodeId) {
			connectionEffects.clearSpotlight(event.data.sourceNodeId as string, event.nodeId);
		}
	}

	/**
	 * Pipeline execution started
	 */
	private onPipelineStart(event: AgentEvent): void {
		// Reset all node states visually
		stateMachine.resetAll();

		// Brief flash to indicate start
		if (currentSettings.milestone.enabled) {
			celebration.showBanner('Pipeline Started', 'info', 1500);
		}
	}

	/**
	 * Pipeline completed successfully
	 */
	private onPipelineComplete(event: AgentEvent): void {
		if (currentSettings.milestone.enabled) {
			celebration.pipelineComplete();
		}
	}

	/**
	 * Pipeline failed
	 */
	private onPipelineFailed(event: AgentEvent): void {
		if (currentSettings.milestone.enabled) {
			celebration.pipelineFailed((event.data?.error as string) || undefined);
		}
	}

	/**
	 * Deviation warning
	 */
	private onDeviationWarn(event: AgentEvent): void {
		// Yellow warning vignette
		celebration.showVignette('warning', 800);

		// If there's a node, highlight it
		if (event.nodeId) {
			animationManager.highlightNode(event.nodeId, '#f59e0b', 1000);
		}
	}

	/**
	 * Manually trigger an effect (for testing/demos)
	 */
	triggerEffect(
		type: 'burst' | 'spotlight' | 'shake' | 'confetti' | 'banner',
		nodeId?: string,
		options?: Record<string, unknown>
	): void {
		switch (type) {
			case 'burst':
				if (nodeId) particleSystem.burst(nodeId);
				break;
			case 'spotlight':
				if (nodeId) spotlightManager.activate(nodeId);
				break;
			case 'shake':
				if (nodeId) animationManager.shakeNode(nodeId);
				break;
			case 'confetti':
				celebration.confetti();
				break;
			case 'banner':
				celebration.showBanner((options?.message as string) || 'Test Banner', 'info');
				break;
		}
	}

	/**
	 * Cleanup and destroy
	 */
	destroy(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		animationManager.cancelAll();
		particleSystem.destroy();
		spotlightManager.destroy();
		connectionEffects.destroy();
		celebration.destroy();

		this.initialized = false;
		console.log('[EffectsEngine] Destroyed');
	}

	/**
	 * Check if initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Pause all effects (for performance)
	 */
	pause(): void {
		particleSystem.stop();
		animationManager.cancelAll();
	}

	/**
	 * Resume effects
	 */
	resume(): void {
		// Effects will resume on next event
	}
}

// Export singleton instance
export const effectsEngine = new EffectsEngine();

// Export class for testing
export { EffectsEngine };
