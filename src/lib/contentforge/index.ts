/**
 * ContentForge - Viral Content Analysis Pipeline
 *
 * A multi-agent system for analyzing high-performing social media content.
 *
 * @example
 * ```typescript
 * import { createOrchestrator, MarketingAgent } from '$lib/contentforge';
 *
 * const orchestrator = createOrchestrator();
 * orchestrator.registerAgent(new MarketingAgent());
 * const result = await orchestrator.execute(scrapedData);
 * ```
 */

// Types
export * from './types';

// Base Agent
export { BaseAgent, type AgentConfig } from './agents/base-agent';

// Orchestrator
export {
	createOrchestrator,
	type Orchestrator,
	type OrchestratorConfig,
	type OrchestratorResult
} from './services/orchestrator';
