/**
 * Learning Reinforcement Service
 *
 * Links outcomes back to decisions to improve future suggestions:
 * - Reinforce successful decisions (boost confidence)
 * - Penalize failed decisions (reduce confidence)
 * - Track decision → outcome chains
 * - Adjust pattern weights based on usage
 */

import { memoryClient } from './memory-client';
import type { Memory } from '$lib/types/memory';
import type { Mission, MissionTask } from '$lib/services/mcp-client';

// ============================================
// Types
// ============================================

export interface ReinforcementResult {
	/** Number of decisions reinforced */
	reinforced: number;
	/** Number of patterns boosted */
	patternsBoosted: number;
	/** Number of patterns penalized */
	patternsPenalized: number;
	/** New learnings extracted */
	newLearnings: string[];
	/** Errors encountered */
	errors: string[];
}

export interface DecisionOutcome {
	decisionId: string;
	taskId: string;
	success: boolean;
	duration?: number;
	errorMessage?: string;
}

export interface MissionSummary {
	missionId: string;
	missionName: string;
	totalTasks: number;
	successfulTasks: number;
	failedTasks: number;
	successRate: number;
	skillsUsed: string[];
	patterns: PatternUsage[];
	learnings: LearningSummary[];
	duration: number;
}

export interface PatternUsage {
	patternId: string;
	content: string;
	wasApplied: boolean;
	outcome: 'success' | 'failure' | 'partial';
	confidenceChange: number;
}

export interface LearningSummary {
	id: string;
	content: string;
	type: 'success' | 'failure' | 'optimization';
	skillId?: string;
	confidence: number;
}

// ============================================
// Reinforcement Functions
// ============================================

/**
 * Reinforce a decision based on its outcome
 * Updates the decision memory with outcome data and adjusts confidence
 */
export async function reinforceDecision(
	decisionId: string,
	outcome: 'success' | 'failure',
	quality: number = 1.0
): Promise<boolean> {
	try {
		// Get the original decision memory
		const result = await memoryClient.getMemory(decisionId);
		if (!result.success || !result.data) {
			console.error('[Reinforcement] Decision not found:', decisionId);
			return false;
		}

		const decision = result.data;
		const currentConfidence = decision.metadata?.confidence ?? 0.5;

		// Calculate new confidence based on outcome
		// Success boosts by quality * 0.1, failure reduces by quality * 0.15
		let newConfidence: number;
		if (outcome === 'success') {
			newConfidence = Math.min(1.0, currentConfidence + (quality * 0.1));
		} else {
			newConfidence = Math.max(0.1, currentConfidence - (quality * 0.15));
		}

		// Record the reinforcement as a new memory (Lite tier doesn't support updates)
		await memoryClient.createMemory({
			content: `Reinforcement: ${outcome} for decision "${decision.content.slice(0, 50)}..."`,
			content_type: 'decision_reinforcement',
			temporal_level: 2, // Situational
			salience: 0.5,
			metadata: {
				original_decision_id: decisionId,
				outcome,
				quality,
				old_confidence: currentConfidence,
				new_confidence: newConfidence,
				agent_id: decision.metadata?.agent_id,
				skill_id: decision.metadata?.skill_id,
				mission_id: decision.metadata?.mission_id
			}
		});

		console.log(`[Reinforcement] Decision ${decisionId}: ${currentConfidence.toFixed(2)} → ${newConfidence.toFixed(2)} (${outcome})`);
		return true;
	} catch (error) {
		console.error('[Reinforcement] Failed to reinforce decision:', error);
		return false;
	}
}

/**
 * Batch reinforce all decisions from a mission
 * Maps task outcomes to their corresponding decisions
 */
export async function reinforceMission(
	missionId: string,
	taskOutcomes: Record<string, boolean>
): Promise<ReinforcementResult> {
	const result: ReinforcementResult = {
		reinforced: 0,
		patternsBoosted: 0,
		patternsPenalized: 0,
		newLearnings: [],
		errors: []
	};

	try {
		// Find all decisions for this mission
		const decisionsResult = await memoryClient.retrieve(`mission ${missionId}`, {
			limit: 50,
			content_types: ['agent_decision']
		});

		if (!decisionsResult.success || !decisionsResult.data) {
			result.errors.push('Failed to retrieve mission decisions');
			return result;
		}

		// Filter to only this mission's decisions
		const missionDecisions = decisionsResult.data.memories.filter(
			sm => sm.memory.metadata?.mission_id === missionId
		);

		// Reinforce each decision based on its task outcome
		for (const scoredMemory of missionDecisions) {
			const decision = scoredMemory.memory;
			const taskId = decision.metadata?.task_id;

			if (taskId && taskId in taskOutcomes) {
				const success = taskOutcomes[taskId];
				const reinforced = await reinforceDecision(
					decision.memory_id,
					success ? 'success' : 'failure'
				);

				if (reinforced) {
					result.reinforced++;
				} else {
					result.errors.push(`Failed to reinforce decision for task ${taskId}`);
				}
			}
		}

		// Also reinforce any patterns that were used
		const patternsResult = await memoryClient.retrieve(`workflow pattern mission ${missionId}`, {
			limit: 10,
			content_types: ['workflow_pattern']
		});

		if (patternsResult.success && patternsResult.data) {
			const successRate = Object.values(taskOutcomes).filter(Boolean).length /
				Object.keys(taskOutcomes).length;

			for (const pattern of patternsResult.data.memories) {
				if (pattern.memory.metadata?.mission_id === missionId) {
					if (successRate >= 0.7) {
						await boostPattern(pattern.memory.memory_id, successRate * 0.1);
						result.patternsBoosted++;
					} else if (successRate < 0.5) {
						await penalizePattern(pattern.memory.memory_id, (1 - successRate) * 0.1);
						result.patternsPenalized++;
					}
				}
			}
		}

		return result;
	} catch (error) {
		console.error('[Reinforcement] Failed to reinforce mission:', error);
		result.errors.push(error instanceof Error ? error.message : 'Unknown error');
		return result;
	}
}

/**
 * Boost a pattern's confidence based on successful usage
 */
export async function boostPattern(
	patternId: string,
	amount: number
): Promise<boolean> {
	try {
		const result = await memoryClient.getMemory(patternId);
		if (!result.success || !result.data) return false;

		const pattern = result.data;
		const successCount = (pattern.metadata?.success_count ?? 0) + 1;
		const currentConfidence = pattern.metadata?.confidence ?? 0.5;
		const newConfidence = Math.min(1.0, currentConfidence + amount);

		// Record the boost
		await memoryClient.createMemory({
			content: `Pattern boost: ${pattern.content.slice(0, 50)}...`,
			content_type: 'pattern_reinforcement',
			temporal_level: 2,
			salience: 0.4,
			metadata: {
				pattern_id: patternId,
				action: 'boost',
				amount,
				success_count: successCount,
				old_confidence: currentConfidence,
				new_confidence: newConfidence
			}
		});

		console.log(`[Reinforcement] Pattern boosted: ${patternId} (+${amount.toFixed(2)})`);
		return true;
	} catch (error) {
		console.error('[Reinforcement] Failed to boost pattern:', error);
		return false;
	}
}

/**
 * Penalize a pattern's confidence based on failed usage
 */
export async function penalizePattern(
	patternId: string,
	amount: number
): Promise<boolean> {
	try {
		const result = await memoryClient.getMemory(patternId);
		if (!result.success || !result.data) return false;

		const pattern = result.data;
		const failureCount = (pattern.metadata?.failure_count ?? 0) + 1;
		const currentConfidence = pattern.metadata?.confidence ?? 0.5;
		const newConfidence = Math.max(0.1, currentConfidence - amount);

		// Record the penalty
		await memoryClient.createMemory({
			content: `Pattern penalty: ${pattern.content.slice(0, 50)}...`,
			content_type: 'pattern_reinforcement',
			temporal_level: 2,
			salience: 0.5,
			metadata: {
				pattern_id: patternId,
				action: 'penalize',
				amount,
				failure_count: failureCount,
				old_confidence: currentConfidence,
				new_confidence: newConfidence
			}
		});

		console.log(`[Reinforcement] Pattern penalized: ${patternId} (-${amount.toFixed(2)})`);
		return true;
	} catch (error) {
		console.error('[Reinforcement] Failed to penalize pattern:', error);
		return false;
	}
}

// ============================================
// Mission Summary Generation
// ============================================

/**
 * Generate a comprehensive summary of what was learned from a mission
 */
export async function generateMissionSummary(
	mission: Mission,
	startTime: Date,
	endTime: Date
): Promise<MissionSummary> {
	const taskOutcomes = mission.tasks.reduce((acc, task) => {
		acc[task.id] = task.status === 'completed';
		return acc;
	}, {} as Record<string, boolean>);

	const successfulTasks = mission.tasks.filter(t => t.status === 'completed').length;
	const failedTasks = mission.tasks.filter(t => t.status === 'failed').length;
	const successRate = successfulTasks / mission.tasks.length;

	// Collect skills used
	const skillsUsed = new Set<string>();
	for (const agent of mission.agents) {
		for (const skill of agent.skills || []) {
			skillsUsed.add(skill);
		}
	}

	// Get learnings created during this mission
	const learningsResult = await memoryClient.retrieve(`mission ${mission.id}`, {
		limit: 20,
		content_types: ['agent_learning']
	});

	const learnings: LearningSummary[] = [];
	if (learningsResult.success && learningsResult.data) {
		for (const sm of learningsResult.data.memories) {
			if (sm.memory.metadata?.mission_id === mission.id) {
				learnings.push({
					id: sm.memory.memory_id,
					content: sm.memory.content,
					type: sm.memory.metadata?.pattern_type || 'success',
					skillId: sm.memory.metadata?.skill_id,
					confidence: sm.memory.metadata?.confidence ?? sm.memory.effective_salience
				});
			}
		}
	}

	// Get patterns that were applied
	const patternsResult = await memoryClient.retrieve(`workflow pattern mission ${mission.id}`, {
		limit: 10,
		content_types: ['workflow_pattern']
	});

	const patterns: PatternUsage[] = [];
	if (patternsResult.success && patternsResult.data) {
		for (const sm of patternsResult.data.memories) {
			if (sm.memory.metadata?.mission_id === mission.id) {
				patterns.push({
					patternId: sm.memory.memory_id,
					content: sm.memory.content,
					wasApplied: true,
					outcome: successRate >= 0.7 ? 'success' : successRate >= 0.5 ? 'partial' : 'failure',
					confidenceChange: successRate >= 0.7 ? 0.1 : successRate < 0.5 ? -0.1 : 0
				});
			}
		}
	}

	return {
		missionId: mission.id,
		missionName: mission.name,
		totalTasks: mission.tasks.length,
		successfulTasks,
		failedTasks,
		successRate,
		skillsUsed: Array.from(skillsUsed),
		patterns,
		learnings,
		duration: endTime.getTime() - startTime.getTime()
	};
}

/**
 * Extract key insights from a mission for the review panel
 */
export function extractKeyInsights(summary: MissionSummary): string[] {
	const insights: string[] = [];

	// Success rate insight
	if (summary.successRate >= 0.9) {
		insights.push(`Excellent execution: ${Math.round(summary.successRate * 100)}% success rate`);
	} else if (summary.successRate >= 0.7) {
		insights.push(`Good execution: ${Math.round(summary.successRate * 100)}% success rate`);
	} else if (summary.successRate >= 0.5) {
		insights.push(`Partial success: ${Math.round(summary.successRate * 100)}% of tasks completed`);
	} else {
		insights.push(`Needs improvement: only ${Math.round(summary.successRate * 100)}% success rate`);
	}

	// Skills insight
	if (summary.skillsUsed.length > 0) {
		insights.push(`Used ${summary.skillsUsed.length} skill${summary.skillsUsed.length > 1 ? 's' : ''}: ${summary.skillsUsed.slice(0, 3).join(', ')}${summary.skillsUsed.length > 3 ? '...' : ''}`);
	}

	// Pattern insight
	if (summary.patterns.length > 0) {
		const boosted = summary.patterns.filter(p => p.confidenceChange > 0).length;
		if (boosted > 0) {
			insights.push(`${boosted} pattern${boosted > 1 ? 's' : ''} reinforced based on success`);
		}
	}

	// Learning insight
	if (summary.learnings.length > 0) {
		insights.push(`${summary.learnings.length} new learning${summary.learnings.length > 1 ? 's' : ''} recorded`);
	}

	// Duration insight
	const durationSec = Math.round(summary.duration / 1000);
	if (durationSec < 60) {
		insights.push(`Completed in ${durationSec}s`);
	} else {
		const minutes = Math.floor(durationSec / 60);
		const seconds = durationSec % 60;
		insights.push(`Completed in ${minutes}m ${seconds}s`);
	}

	return insights;
}

/**
 * Get recommendations for future runs based on mission outcome
 */
export function getRecommendations(summary: MissionSummary): string[] {
	const recommendations: string[] = [];

	// If there were failures, suggest what to check
	if (summary.failedTasks > 0) {
		recommendations.push('Review failed tasks to understand root causes');

		if (summary.successRate < 0.5) {
			recommendations.push('Consider breaking down complex tasks into smaller steps');
		}
	}

	// If success rate is high, suggest building on it
	if (summary.successRate >= 0.8) {
		recommendations.push('This workflow pattern is working well - consider saving it');
	}

	// If new learnings were created
	if (summary.learnings.length > 0) {
		recommendations.push('Review new learnings in the Mind Dashboard');
	}

	// If patterns were penalized
	const penalized = summary.patterns.filter(p => p.confidenceChange < 0);
	if (penalized.length > 0) {
		recommendations.push('Some patterns may need adjustment - check pattern confidence');
	}

	return recommendations;
}
