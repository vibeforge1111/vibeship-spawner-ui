/**
 * Learning Query Service
 *
 * Cross-agent learning system that:
 * - Queries learnings across all agents
 * - Finds similar patterns and situations
 * - Aggregates collective intelligence
 * - Provides proactive suggestions
 */

import { memoryClient } from './memory-client';
import type { Memory, ScoredMemory } from '$lib/types/memory';

// ============================================
// Types
// ============================================

export interface LearningQuery {
	query: string;
	agentIds?: string[];       // Filter by specific agents
	skillIds?: string[];       // Filter by skills used
	patternTypes?: ('success' | 'failure' | 'optimization')[];
	minConfidence?: number;
	limit?: number;
}

export interface SimilarSituation {
	description: string;
	learnings: Memory[];
	suggestedApproach?: string;
	confidence: number;
}

export interface AgentInsight {
	agentId: string;
	totalLearnings: number;
	successRate: number;
	topSkills: string[];
	recentLearnings: Memory[];
}

export interface CollectiveIntelligence {
	totalLearnings: number;
	totalPatterns: number;
	agentCount: number;
	topPatterns: Memory[];
	recentInsights: Memory[];
	successfulApproaches: string[];
}

// ============================================
// Query Functions
// ============================================

/**
 * Search learnings across all agents
 */
export async function searchLearnings(query: LearningQuery): Promise<Memory[]> {
	try {
		const result = await memoryClient.retrieve(query.query, {
			limit: query.limit || 20,
			content_types: ['agent_learning', 'agent_decision'],
			agent_id: query.agentIds?.[0]  // Mind API only supports single agent_id filter currently
		});

		if (!result.success || !result.data) {
			return [];
		}

		let memories = result.data.memories.map(sm => sm.memory);

		// Apply additional filters
		if (query.patternTypes && query.patternTypes.length > 0) {
			memories = memories.filter(m => {
				const meta = m.metadata;
				const patternType = meta?.pattern_type;
				return (
					patternType === 'success' ||
					patternType === 'failure' ||
					patternType === 'optimization'
				) && query.patternTypes!.includes(patternType);
			});
		}

		if (query.minConfidence !== undefined) {
			memories = memories.filter(m => {
				const meta = m.metadata as { confidence?: number };
				return (meta?.confidence || 0) >= query.minConfidence!;
			});
		}

		if (query.skillIds && query.skillIds.length > 0) {
			memories = memories.filter(m => {
				const meta = m.metadata as { skill_id?: string };
				return meta?.skill_id && query.skillIds!.includes(meta.skill_id);
			});
		}

		return memories;
	} catch (error) {
		console.error('[LearningQuery] Search failed:', error);
		return [];
	}
}

/**
 * Find similar situations from past missions
 */
export async function findSimilarSituations(
	currentSituation: string,
	limit: number = 5
): Promise<SimilarSituation[]> {
	try {
		// Search for similar past situations
		const result = await memoryClient.retrieve(currentSituation, {
			limit: limit * 2,  // Get more to filter
			content_types: ['agent_learning', 'workflow_pattern']
		});

		if (!result.success || !result.data) {
			return [];
		}

		// Group learnings by situation/mission
		const situationMap = new Map<string, Memory[]>();

		for (const scored of result.data.memories) {
			const meta = scored.memory.metadata as { mission_id?: string };
			const key = meta?.mission_id || scored.memory.memory_id;

			if (!situationMap.has(key)) {
				situationMap.set(key, []);
			}
			situationMap.get(key)!.push(scored.memory);
		}

		// Convert to SimilarSituation objects
		const situations: SimilarSituation[] = [];

		for (const [, learnings] of situationMap) {
			if (learnings.length === 0) continue;

			// Find successful approaches
			const successLearnings = learnings.filter(l => {
				const meta = l.metadata as { pattern_type?: string };
				return meta?.pattern_type === 'success';
			});

			const suggestedApproach = successLearnings.length > 0
				? successLearnings[0].content
				: undefined;

			// Calculate confidence from learnings
			const avgConfidence = learnings.reduce((sum, l) => {
				const meta = l.metadata as { confidence?: number };
				return sum + (meta?.confidence || 0.5);
			}, 0) / learnings.length;

			situations.push({
				description: learnings[0].content.slice(0, 100),
				learnings,
				suggestedApproach,
				confidence: avgConfidence
			});
		}

		return situations
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, limit);
	} catch (error) {
		console.error('[LearningQuery] Find similar situations failed:', error);
		return [];
	}
}

/**
 * Get insights for a specific agent
 */
export async function getAgentInsight(agentId: string): Promise<AgentInsight | null> {
	try {
		// Get agent's learnings
		const result = await memoryClient.retrieve(`agent:${agentId}`, {
			limit: 50,
			content_types: ['agent_learning', 'agent_decision'],
			agent_id: agentId
		});

		if (!result.success || !result.data) {
			return null;
		}

		const learnings = result.data.memories.map(sm => sm.memory);

		// Calculate stats
		let successCount = 0;
		let failCount = 0;
		const skillUsage = new Map<string, number>();

		for (const learning of learnings) {
			const meta = learning.metadata as { pattern_type?: string; skill_id?: string };

			if (meta?.pattern_type === 'success') successCount++;
			if (meta?.pattern_type === 'failure') failCount++;

			if (meta?.skill_id) {
				skillUsage.set(meta.skill_id, (skillUsage.get(meta.skill_id) || 0) + 1);
			}
		}

		const totalOutcomes = successCount + failCount;
		const successRate = totalOutcomes > 0 ? successCount / totalOutcomes : 0;

		// Get top skills
		const topSkills = Array.from(skillUsage.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([skill]) => skill);

		return {
			agentId,
			totalLearnings: learnings.length,
			successRate,
			topSkills,
			recentLearnings: learnings.slice(0, 10)
		};
	} catch (error) {
		console.error('[LearningQuery] Get agent insight failed:', error);
		return null;
	}
}

/**
 * Get collective intelligence across all agents
 */
export async function getCollectiveIntelligence(): Promise<CollectiveIntelligence> {
	try {
		// Get all learnings
		const learningsResult = await memoryClient.retrieve('agent learning', {
			limit: 100,
			content_types: ['agent_learning']
		});

		// Get all patterns
		const patternsResult = await memoryClient.retrieve('workflow pattern', {
			limit: 50,
			content_types: ['workflow_pattern']
		});

		const learnings = learningsResult.success && learningsResult.data
			? learningsResult.data.memories.map(sm => sm.memory)
			: [];

		const patterns = patternsResult.success && patternsResult.data
			? patternsResult.data.memories.map(sm => sm.memory)
			: [];

		// Count unique agents
		const agentIds = new Set<string>();
		for (const learning of learnings) {
			const meta = learning.metadata as { agent_id?: string };
			if (meta?.agent_id) agentIds.add(meta.agent_id);
		}

		// Extract successful approaches
		const successfulApproaches = learnings
			.filter(l => {
				const meta = l.metadata as { pattern_type?: string };
				return meta?.pattern_type === 'success';
			})
			.slice(0, 10)
			.map(l => l.content);

		return {
			totalLearnings: learnings.length,
			totalPatterns: patterns.length,
			agentCount: agentIds.size,
			topPatterns: patterns.slice(0, 5),
			recentInsights: learnings.slice(0, 10),
			successfulApproaches
		};
	} catch (error) {
		console.error('[LearningQuery] Get collective intelligence failed:', error);
		return {
			totalLearnings: 0,
			totalPatterns: 0,
			agentCount: 0,
			topPatterns: [],
			recentInsights: [],
			successfulApproaches: []
		};
	}
}

/**
 * Get suggestions for a specific skill
 */
export async function getSkillSuggestions(skillId: string): Promise<Memory[]> {
	try {
		const result = await memoryClient.retrieve(`skill:${skillId}`, {
			limit: 20,
			content_types: ['agent_learning', 'workflow_pattern']
		});

		if (!result.success || !result.data) {
			return [];
		}

		// Filter to learnings that mention this skill
		return result.data.memories
			.map(sm => sm.memory)
			.filter(m => {
				const meta = m.metadata as { skill_id?: string; skill_sequence?: string[] };
				return meta?.skill_id === skillId ||
					   meta?.skill_sequence?.includes(skillId);
			});
	} catch (error) {
		console.error('[LearningQuery] Get skill suggestions failed:', error);
		return [];
	}
}

/**
 * Get failure warnings for a goal
 */
export async function getFailureWarnings(goalDescription: string): Promise<Memory[]> {
	try {
		const result = await memoryClient.retrieve(goalDescription, {
			limit: 10,
			content_types: ['agent_learning']
		});

		if (!result.success || !result.data) {
			return [];
		}

		// Filter to failure learnings only
		return result.data.memories
			.map(sm => sm.memory)
			.filter(m => {
				const meta = m.metadata as { pattern_type?: string };
				return meta?.pattern_type === 'failure';
			});
	} catch (error) {
		console.error('[LearningQuery] Get failure warnings failed:', error);
		return [];
	}
}
