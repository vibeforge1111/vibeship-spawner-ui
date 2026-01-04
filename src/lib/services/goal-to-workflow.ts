/**
 * Goal-to-Workflow Orchestration Service
 *
 * Coordinates the full pipeline: analyze → match → generate
 */

import { analyzeGoal, validateInput } from './goal-analyzer';
import { matchSkills, getSkillById } from './skill-matcher';
import { generateOptimalWorkflow } from './workflow-generator';
import {
	setGoalInput,
	setProcessingState,
	setAnalyzedGoal,
	setMatchResult,
	setWorkflow,
	getGoalState
} from '$lib/stores/project-goal.svelte';
import { addNodesWithConnections } from '$lib/stores/canvas.svelte';
import { skills as skillsStore, loadSkills } from '$lib/stores/skills.svelte';
import { get } from 'svelte/store';
import type { GeneratedWorkflow, GoalProcessingState, MatchedSkill } from '$lib/types/goal';
import type { Skill } from '$lib/stores/skills.svelte';

export interface ProcessingResult {
	success: boolean;
	workflow?: GeneratedWorkflow;
	error?: string;
	needsClarification?: boolean;
	clarificationPrompt?: string;
}

/**
 * Process a goal description through the full pipeline
 */
export async function processGoal(input: string): Promise<ProcessingResult> {
	// Store the input
	setGoalInput(input);

	try {
		// Step 0: Ensure skills are loaded
		const currentSkills = get(skillsStore);
		if (currentSkills.length === 0) {
			setProcessingState({
				status: 'analyzing',
				progress: 5,
				message: 'Loading skills...'
			});
			await loadSkills();
		}

		// Step 1: Validate input
		setProcessingState({
			status: 'analyzing',
			progress: 10,
			message: 'Validating input...'
		});

		const validation = validateInput(input);
		if (!validation.valid) {
			setProcessingState({
				status: 'error',
				progress: 0,
				message: validation.error || 'Invalid input',
				error: validation.error
			});
			return {
				success: false,
				error: validation.error
			};
		}

		// Step 2: Analyze the goal
		setProcessingState({
			status: 'analyzing',
			progress: 30,
			message: 'Analyzing your project...'
		});

		const analyzedGoal = analyzeGoal(validation.sanitized);
		setAnalyzedGoal(analyzedGoal);

		// Check if clarification needed
		if (analyzedGoal.needsClarification) {
			setProcessingState({
				status: 'idle',
				progress: 0,
				message: analyzedGoal.clarificationPrompt || 'Please provide more details.'
			});
			return {
				success: false,
				needsClarification: true,
				clarificationPrompt: analyzedGoal.clarificationPrompt
			};
		}

		// Step 3: Match skills
		setProcessingState({
			status: 'matching',
			progress: 60,
			message: 'Finding relevant skills...'
		});

		const matchResult = await matchSkills(analyzedGoal);
		setMatchResult(matchResult);

		if (matchResult.skills.length === 0) {
			setProcessingState({
				status: 'error',
				progress: 0,
				message: 'No matching skills found. Try being more specific.',
				error: 'No skills matched'
			});
			return {
				success: false,
				error: 'No matching skills found. Try describing specific technologies or features you want to use.'
			};
		}

		// Step 4: Generate workflow
		setProcessingState({
			status: 'generating',
			progress: 80,
			message: 'Creating your workflow...'
		});

		const workflow = generateOptimalWorkflow(matchResult.skills, analyzedGoal);
		setWorkflow(workflow);

		// Complete!
		setProcessingState({
			status: 'complete',
			progress: 100,
			message: `Added ${workflow.nodes.length} skills to your workflow`
		});

		return {
			success: true,
			workflow
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
		setProcessingState({
			status: 'error',
			progress: 0,
			message: errorMessage,
			error: errorMessage
		});
		return {
			success: false,
			error: errorMessage
		};
	}
}

/**
 * Get current processing state
 */
export function getProcessingState(): GoalProcessingState {
	return getGoalState().processing;
}

/**
 * Check if currently processing
 */
export function isProcessing(): boolean {
	const status = getGoalState().processing.status;
	return status === 'analyzing' || status === 'matching' || status === 'generating';
}

/**
 * Retry processing with current input
 */
export async function retryProcessing(): Promise<ProcessingResult> {
	const currentInput = getGoalState().input;
	if (!currentInput) {
		return { success: false, error: 'No input to retry' };
	}
	return processGoal(currentInput);
}

/**
 * Process with additional context (for clarification responses)
 */
export async function processWithClarification(
	originalInput: string,
	clarification: string
): Promise<ProcessingResult> {
	const combinedInput = `${originalInput}\n\nAdditional context: ${clarification}`;
	return processGoal(combinedInput);
}

/**
 * Create a skill object from matched skill data
 * Falls back to creating a minimal skill if not found in store
 */
function createSkillFromMatch(matched: MatchedSkill): Skill {
	// Try to get the full skill from the store
	const fullSkill = getSkillById(matched.skillId);
	if (fullSkill) {
		return fullSkill;
	}

	// Create a minimal skill object from the matched data
	return {
		id: matched.skillId,
		name: matched.name,
		description: matched.description,
		category: matched.category as any,
		tier: matched.tier,
		tags: matched.tags || [],
		triggers: []
	};
}

/**
 * Add workflow nodes to the canvas
 */
export function addWorkflowToCanvas(workflow: GeneratedWorkflow): string[] {
	// Convert workflow nodes to skill + position pairs
	const nodeDefs = workflow.nodes.map((node) => {
		// Find the matched skill from the match result
		const goalState = getGoalState();
		const matchedSkill = goalState.matchResult?.skills.find(s => s.skillId === node.skillId);

		if (!matchedSkill) {
			throw new Error(`Skill ${node.skillId} not found in match result`);
		}

		return {
			skill: createSkillFromMatch(matchedSkill),
			position: node.position
		};
	});

	// Convert connections (need to map skillId to node index)
	const skillIdToIndex = new Map<string, number>();
	workflow.nodes.forEach((node, index) => {
		skillIdToIndex.set(node.skillId, index);
	});

	const connectionDefs = workflow.connections
		.filter(conn => skillIdToIndex.has(conn.sourceId) && skillIdToIndex.has(conn.targetId))
		.map((conn) => ({
			sourceIndex: skillIdToIndex.get(conn.sourceId)!,
			targetIndex: skillIdToIndex.get(conn.targetId)!
		}));

	// Add to canvas
	return addNodesWithConnections(nodeDefs, connectionDefs);
}

/**
 * Process goal and add to canvas in one step
 */
export async function processGoalAndAddToCanvas(input: string): Promise<ProcessingResult & { nodeIds?: string[] }> {
	const result = await processGoal(input);

	if (result.success && result.workflow) {
		try {
			const nodeIds = addWorkflowToCanvas(result.workflow);
			return { ...result, nodeIds };
		} catch (error) {
			console.error('Failed to add workflow to canvas:', error);
			return {
				...result,
				error: 'Workflow generated but failed to add to canvas'
			};
		}
	}

	return result;
}
