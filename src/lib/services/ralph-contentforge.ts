/**
 * Ralph + Mind Integration for ContentForge
 *
 * Ralph iterates until success. Mind remembers what worked.
 * Together they create a complete self-improvement loop.
 *
 * Flow:
 * 1. Query Mind for past learnings about this content type
 * 2. Generate Ralph prompt with Mind context + completion criteria
 * 3. Ralph iterates (Mind stays quiet during iteration)
 * 4. On success: Record winning approach to Mind
 * 5. On failure: Record blocker to Mind for future reference
 */

// =============================================================================
// TYPES
// =============================================================================

export interface RalphConfig {
	maxIterations: number;
	qualityThreshold: number;  // Virality score threshold (0-100)
	requiredAgents: string[];  // Which agents must complete
	minRecommendations: number;
}

export interface RalphState {
	iteration: number;
	maxIterations: number;
	isComplete: boolean;
	bestScore: number;
	completionPromise: string;
	startedAt: string;
	completedAt?: string;
	mindContextUsed: string[];
	finalApproach?: string;
}

export interface RalphIteration {
	number: number;
	score: number;
	agentsCompleted: string[];
	recommendationCount: number;
	weakness?: string;
	improvement?: string;
}

export interface RalphResult {
	success: boolean;
	iterations: number;
	finalScore: number;
	approach: string;
	mindLearningsUsed: number;
	timeElapsed: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

export const DEFAULT_RALPH_CONFIG: RalphConfig = {
	maxIterations: 5,
	qualityThreshold: 75,
	requiredAgents: ['marketing', 'copywriting', 'viral-hooks', 'psychology'],
	minRecommendations: 3
};

// =============================================================================
// MIND INTEGRATION
// =============================================================================

/**
 * Query Mind for relevant learnings before Ralph starts
 */
export async function queryMindForContext(contentType: string): Promise<string[]> {
	try {
		const response = await fetch('http://localhost:8080/v1/memories/retrieve', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `contentforge ${contentType} high virality successful patterns`,
				limit: 10
			})
		});

		if (!response.ok) return [];

		const data = await response.json();
		const memories = data.memories || [];

		// Extract relevant learnings
		return memories
			.filter((m: { content: string }) =>
				m.content.includes('ContentForge') ||
				m.content.includes('virality') ||
				m.content.includes('hook')
			)
			.map((m: { content: string }) => m.content)
			.slice(0, 5); // Top 5 most relevant
	} catch (e) {
		console.warn('[Ralph] Failed to query Mind:', e);
		return [];
	}
}

/**
 * Record successful Ralph outcome to Mind
 */
export async function recordSuccessToMind(result: RalphResult): Promise<void> {
	try {
		await fetch('http://localhost:8080/v1/memories/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: `**ContentForge Ralph Success**
Achieved virality score ${result.finalScore} after ${result.iterations} iteration(s).
Time: ${Math.round(result.timeElapsed / 1000)}s
Mind learnings used: ${result.mindLearningsUsed}

**Winning Approach:**
${result.approach}

**Key Insight:** ${result.iterations === 1
	? 'First-pass success - Mind context was sufficient'
	: `Required ${result.iterations} iterations to refine. Each pass improved pattern recognition.`}`,
				temporal_level: 3, // Seasonal - project-level learning
				content_type: 'agent_learning',
				salience: 0.8
			})
		});
		console.log('[Ralph] Recorded success to Mind');
	} catch (e) {
		console.warn('[Ralph] Failed to record success:', e);
	}
}

/**
 * Record Ralph failure/blocker to Mind
 */
export async function recordBlockerToMind(
	iterations: number,
	bestScore: number,
	blocker: string
): Promise<void> {
	try {
		await fetch('http://localhost:8080/v1/memories/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: `**ContentForge Ralph Blocker**
Failed to reach quality threshold after ${iterations} iterations.
Best score achieved: ${bestScore}

**Blocker:**
${blocker}

**For next time:** Consider adjusting quality threshold or providing more specific content context.`,
				temporal_level: 2, // Situational
				content_type: 'project_issue',
				salience: 0.7
			})
		});
		console.log('[Ralph] Recorded blocker to Mind');
	} catch (e) {
		console.warn('[Ralph] Failed to record blocker:', e);
	}
}

// =============================================================================
// RALPH PROMPT GENERATION
// =============================================================================

/**
 * Generate the Ralph-style prompt with Mind context
 */
export function generateRalphPrompt(
	content: string,
	config: RalphConfig,
	mindContext: string[],
	currentIteration: number = 1,
	previousResult?: { score: number; weakness: string }
): string {
	const completionPromise = '<promise>ANALYSIS_COMPLETE</promise>';

	let prompt = `You are running ContentForge analysis in RALPH MODE (iterative self-improvement).

## COMPLETION CRITERIA
You MUST meet ALL of these before outputting the completion promise:
- Virality score >= ${config.qualityThreshold}
- All 4 agents complete: ${config.requiredAgents.join(', ')}
- At least ${config.minRecommendations} actionable recommendations
- Confidence level >= 70%

## ITERATION STATUS
Current iteration: ${currentIteration} of ${config.maxIterations}
`;

	if (previousResult) {
		prompt += `
## PREVIOUS ITERATION RESULT
Score: ${previousResult.score} (need >= ${config.qualityThreshold})
Weakness identified: ${previousResult.weakness}

IMPORTANT: You've already tried once. This iteration must IMPROVE on the previous.
- Go DEEPER on the weak areas
- Find patterns you missed before
- Be more specific in recommendations
`;
	}

	if (mindContext.length > 0) {
		prompt += `
## LEARNINGS FROM MIND (past successes)
These patterns have worked before - use them:
${mindContext.map((l, i) => `${i + 1}. ${l.slice(0, 200)}...`).join('\n')}
`;
	}

	prompt += `
## CONTENT TO ANALYZE
${content}

## YOUR TASK
1. Run full 4-agent analysis (Marketing, Copywriting, Viral Hooks, Psychology)
2. Synthesize findings into actionable recommendations
3. Calculate virality score honestly
4. If score < ${config.qualityThreshold}, identify the weakness for next iteration
5. If score >= ${config.qualityThreshold} AND all criteria met, output:

${completionPromise}

## RESPONSE FORMAT
{
  "iteration": ${currentIteration},
  "agents": {
    "marketing": { "complete": true/false, "insights": [...] },
    "copywriting": { "complete": true/false, "insights": [...] },
    "viralHooks": { "complete": true/false, "insights": [...] },
    "psychology": { "complete": true/false, "insights": [...] }
  },
  "synthesis": {
    "viralityScore": <number 0-100>,
    "confidence": <number 0-100>,
    "recommendations": [...],
    "weakness": "<what needs improvement if score < threshold>",
    "approach": "<what approach finally worked - for Mind to remember>"
  },
  "criteriaMetadata": {
    "scoreThresholdMet": true/false,
    "allAgentsComplete": true/false,
    "minRecommendationsMet": true/false,
    "readyToComplete": true/false
  }
}

If readyToComplete is true, add this at the end:
${completionPromise}
`;

	return prompt;
}

// =============================================================================
// RALPH STATE MANAGEMENT
// =============================================================================

let currentRalphState: RalphState | null = null;

export function startRalphLoop(config: RalphConfig, mindContext: string[]): RalphState {
	currentRalphState = {
		iteration: 0,
		maxIterations: config.maxIterations,
		isComplete: false,
		bestScore: 0,
		completionPromise: '<promise>ANALYSIS_COMPLETE</promise>',
		startedAt: new Date().toISOString(),
		mindContextUsed: mindContext
	};
	return currentRalphState;
}

export function getRalphState(): RalphState | null {
	return currentRalphState;
}

export function updateRalphState(iteration: RalphIteration): RalphState | null {
	if (!currentRalphState) return null;

	currentRalphState.iteration = iteration.number;
	if (iteration.score > currentRalphState.bestScore) {
		currentRalphState.bestScore = iteration.score;
	}

	return currentRalphState;
}

export function completeRalphLoop(success: boolean, finalApproach?: string): RalphState | null {
	if (!currentRalphState) return null;

	currentRalphState.isComplete = true;
	currentRalphState.completedAt = new Date().toISOString();
	if (finalApproach) {
		currentRalphState.finalApproach = finalApproach;
	}

	return currentRalphState;
}

export function cancelRalphLoop(): void {
	currentRalphState = null;
}

// =============================================================================
// EVALUATION
// =============================================================================

/**
 * Check if completion criteria are met
 */
export function checkCompletionCriteria(
	result: {
		viralityScore: number;
		confidence: number;
		agentsComplete: string[];
		recommendationCount: number;
	},
	config: RalphConfig
): { met: boolean; missing: string[] } {
	const missing: string[] = [];

	if (result.viralityScore < config.qualityThreshold) {
		missing.push(`Score ${result.viralityScore} < threshold ${config.qualityThreshold}`);
	}

	if (result.confidence < 70) {
		missing.push(`Confidence ${result.confidence}% < 70%`);
	}

	const missingAgents = config.requiredAgents.filter(
		a => !result.agentsComplete.includes(a)
	);
	if (missingAgents.length > 0) {
		missing.push(`Missing agents: ${missingAgents.join(', ')}`);
	}

	if (result.recommendationCount < config.minRecommendations) {
		missing.push(`Only ${result.recommendationCount} recommendations, need ${config.minRecommendations}`);
	}

	return {
		met: missing.length === 0,
		missing
	};
}

// =============================================================================
// FULL RALPH LOOP ORCHESTRATION
// =============================================================================

/**
 * Run the complete Ralph loop for ContentForge
 * This is the main entry point
 */
export async function runRalphContentForgeLoop(
	content: string,
	config: RalphConfig = DEFAULT_RALPH_CONFIG,
	onIteration?: (iteration: RalphIteration) => void
): Promise<RalphResult> {
	const startTime = Date.now();

	// 1. Query Mind for context
	console.log('[Ralph] Querying Mind for relevant learnings...');
	const mindContext = await queryMindForContext('content analysis');
	console.log(`[Ralph] Found ${mindContext.length} relevant learnings from Mind`);

	// 2. Initialize state
	const state = startRalphLoop(config, mindContext);
	let previousResult: { score: number; weakness: string } | undefined;

	// 3. Iteration loop
	for (let i = 1; i <= config.maxIterations; i++) {
		console.log(`[Ralph] Starting iteration ${i}/${config.maxIterations}`);
		state.iteration = i;

		// Generate prompt with current context
		const prompt = generateRalphPrompt(
			content,
			config,
			mindContext,
			i,
			previousResult
		);

		// Store the prompt for the worker to pick up
		try {
			await fetch('/api/contentforge/ralph/prompt', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prompt,
					iteration: i,
					maxIterations: config.maxIterations
				})
			});
		} catch (e) {
			console.error('[Ralph] Failed to store prompt:', e);
		}

		// Wait for worker to complete this iteration
		// (In real implementation, this would wait for the worker response)
		// For now, we'll return the prompt and let the UI handle it

		const iteration: RalphIteration = {
			number: i,
			score: 0, // Will be filled by worker
			agentsCompleted: [],
			recommendationCount: 0
		};

		onIteration?.(iteration);
		updateRalphState(iteration);

		// Check if we should continue (this would be based on worker response)
		// For now, break after generating the first prompt
		break;
	}

	// 4. Return result (will be completed by worker callback)
	const timeElapsed = Date.now() - startTime;

	return {
		success: false, // Will be updated by worker
		iterations: state.iteration,
		finalScore: state.bestScore,
		approach: 'Pending worker completion',
		mindLearningsUsed: mindContext.length,
		timeElapsed
	};
}

// =============================================================================
// WORKER COMPLETION HANDLER
// =============================================================================

/**
 * Called when the worker completes an iteration
 */
export async function handleWorkerIterationComplete(
	iterationResult: {
		iteration: number;
		viralityScore: number;
		confidence: number;
		agentsComplete: string[];
		recommendations: string[];
		weakness?: string;
		approach?: string;
		completionPromiseFound: boolean;
	},
	config: RalphConfig = DEFAULT_RALPH_CONFIG
): Promise<{ shouldContinue: boolean; nextPrompt?: string }> {
	const state = getRalphState();
	if (!state) {
		return { shouldContinue: false };
	}

	// Update state
	const iteration: RalphIteration = {
		number: iterationResult.iteration,
		score: iterationResult.viralityScore,
		agentsCompleted: iterationResult.agentsComplete,
		recommendationCount: iterationResult.recommendations.length,
		weakness: iterationResult.weakness,
		improvement: iterationResult.approach
	};
	updateRalphState(iteration);

	// Check completion criteria
	const criteria = checkCompletionCriteria({
		viralityScore: iterationResult.viralityScore,
		confidence: iterationResult.confidence,
		agentsComplete: iterationResult.agentsComplete,
		recommendationCount: iterationResult.recommendations.length
	}, config);

	if (criteria.met || iterationResult.completionPromiseFound) {
		// SUCCESS! Record to Mind
		const result: RalphResult = {
			success: true,
			iterations: iterationResult.iteration,
			finalScore: iterationResult.viralityScore,
			approach: iterationResult.approach || 'Standard analysis',
			mindLearningsUsed: state.mindContextUsed.length,
			timeElapsed: Date.now() - new Date(state.startedAt).getTime()
		};

		await recordSuccessToMind(result);
		completeRalphLoop(true, iterationResult.approach);

		return { shouldContinue: false };
	}

	// Check if we've hit max iterations
	if (iterationResult.iteration >= state.maxIterations) {
		// FAILURE - Record blocker to Mind
		await recordBlockerToMind(
			iterationResult.iteration,
			state.bestScore,
			criteria.missing.join('; ')
		);
		completeRalphLoop(false);

		return { shouldContinue: false };
	}

	// CONTINUE - Generate next iteration prompt
	// Content would need to be passed in or stored
	return {
		shouldContinue: true,
		nextPrompt: `Continue iteration ${iterationResult.iteration + 1}.
Previous score: ${iterationResult.viralityScore}
Weakness to address: ${iterationResult.weakness}
Go deeper and improve.`
	};
}
