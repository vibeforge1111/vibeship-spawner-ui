/**
 * Agent Orchestrator Service
 *
 * Coordinates multiple AI agents to analyze content in parallel.
 * Request-scoped - no global state (SvelteKit SSR safe).
 */

import type {
	ScrapedData,
	AgentOutput,
	AgentType,
	MarketingAnalysis,
	CopywritingAnalysis,
	ResearchAnalysis,
	PsychologyAnalysis
} from '../types';
import type { BaseAgent } from '../agents/base-agent';

export interface OrchestratorConfig {
	parallelExecution: boolean;
	timeout: number; // ms
	retryAttempts: number;
}

export interface OrchestratorResult {
	postId: string;
	success: boolean;
	results: {
		marketing?: AgentOutput<MarketingAnalysis>;
		copywriting?: AgentOutput<CopywritingAnalysis>;
		research?: AgentOutput<ResearchAnalysis>;
		psychology?: AgentOutput<PsychologyAnalysis>;
	};
	totalProcessingTimeMs: number;
	startedAt: string;
	completedAt: string;
	errors: { agent: AgentType; error: string }[];
}

type AgentOutputMap = {
	marketing: AgentOutput<MarketingAnalysis>;
	copywriting: AgentOutput<CopywritingAnalysis>;
	research: AgentOutput<ResearchAnalysis>;
	psychology: AgentOutput<PsychologyAnalysis>;
};

/**
 * Creates a new orchestrator instance.
 * Call this per-request to avoid SSR state leaks.
 */
export function createOrchestrator(config: Partial<OrchestratorConfig> = {}) {
	const defaultConfig: OrchestratorConfig = {
		parallelExecution: true,
		timeout: 60000,
		retryAttempts: 2
	};

	const finalConfig = { ...defaultConfig, ...config };
	const agents = new Map<AgentType, BaseAgent<unknown>>();

	return {
		/**
		 * Register an agent with the orchestrator.
		 */
		registerAgent<T>(agent: BaseAgent<T>): void {
			agents.set(agent.getConfig().type, agent as BaseAgent<unknown>);
		},

		/**
		 * Execute all registered agents on the scraped data.
		 */
		async execute(
			data: ScrapedData,
			requestedAgents: AgentType[] | 'all' = 'all'
		): Promise<OrchestratorResult> {
			const startedAt = new Date().toISOString();
			const startTime = Date.now();
			const results: OrchestratorResult['results'] = {};
			const errors: { agent: AgentType; error: string }[] = [];

			// Determine which agents to run
			const agentsToRun =
				requestedAgents === 'all'
					? Array.from(agents.keys())
					: requestedAgents.filter((type) => agents.has(type));

			if (finalConfig.parallelExecution) {
				// Run agents in parallel
				const promises = agentsToRun.map(async (type) => {
					const agent = agents.get(type);
					if (!agent) return;

					try {
						const result = await executeWithTimeout(
							agent.analyze(data),
							finalConfig.timeout
						);
						(results as Record<string, AgentOutput<unknown>>)[type] = result;
					} catch (err) {
						const errorMessage = err instanceof Error ? err.message : 'Unknown error';
						errors.push({ agent: type, error: errorMessage });
					}
				});

				await Promise.all(promises);
			} else {
				// Run agents sequentially
				for (const type of agentsToRun) {
					const agent = agents.get(type);
					if (!agent) continue;

					try {
						const result = await executeWithTimeout(
							agent.analyze(data),
							finalConfig.timeout
						);
						(results as Record<string, AgentOutput<unknown>>)[type] = result;
					} catch (err) {
						const errorMessage = err instanceof Error ? err.message : 'Unknown error';
						errors.push({ agent: type, error: errorMessage });
					}
				}
			}

			return {
				postId: data.postId,
				success: errors.length === 0,
				results,
				totalProcessingTimeMs: Date.now() - startTime,
				startedAt,
				completedAt: new Date().toISOString(),
				errors
			};
		},

		/**
		 * Get typed results for specific agents.
		 */
		getTypedResults(result: OrchestratorResult): Partial<AgentOutputMap> {
			return result.results;
		},

		/**
		 * Get list of registered agents.
		 */
		getRegisteredAgents(): AgentType[] {
			return Array.from(agents.keys());
		}
	};
}

/**
 * Execute a promise with timeout.
 */
async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout>;

	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(`Operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});

	try {
		const result = await Promise.race([promise, timeoutPromise]);
		clearTimeout(timeoutId!);
		return result;
	} catch (err) {
		clearTimeout(timeoutId!);
		throw err;
	}
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
