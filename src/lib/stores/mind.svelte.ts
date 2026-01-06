/**
 * Mind Store - Manages project memory and knowledge
 *
 * Provides state management for:
 * - Project decisions and their rationale
 * - Open/resolved issues
 * - Session summaries
 * - Validated patterns
 * - Agent learnings (from Mind v5 integration)
 * - Workflow patterns
 */

import { writable, derived, get } from 'svelte/store';
import { mcpClient } from '$lib/services/mcp-client';
import { memoryClient } from '$lib/services/memory-client';
import type { MindProject, MindDecision, MindIssue } from '$lib/services/mcp-client';
import type { Memory, AgentLearning, WorkflowPattern, AgentEffectiveness } from '$lib/types/memory';

export interface MindState {
	project: MindProject | null;
	loading: boolean;
	error: string | null;
	// Agent learning state
	learnings: Memory[];
	patterns: Memory[];
	agentStats: Record<string, AgentEffectiveness>;
	learningsLoading: boolean;
	memoryConnected: boolean;
}

const initialState: MindState = {
	project: null,
	loading: false,
	error: null,
	learnings: [],
	patterns: [],
	agentStats: {},
	learningsLoading: false,
	memoryConnected: false
};

export const mindState = writable<MindState>(initialState);

// Derived stores for convenience
export const currentProject = derived(mindState, ($state) => $state.project);
export const decisions = derived(mindState, ($state) => $state.project?.decisions ?? []);
export const issues = derived(mindState, ($state) => $state.project?.issues ?? []);
export const openIssues = derived(issues, ($issues) => $issues.filter((i) => i.status === 'open'));
export const resolvedIssues = derived(issues, ($issues) => $issues.filter((i) => i.status === 'resolved'));
export const sessions = derived(mindState, ($state) => $state.project?.sessions ?? []);
export const isLoading = derived(mindState, ($state) => $state.loading);
export const hasError = derived(mindState, ($state) => $state.error !== null);

// Learning-related derived stores
export const learnings = derived(mindState, ($state) => $state.learnings);
export const patterns = derived(mindState, ($state) => $state.patterns);
export const agentStats = derived(mindState, ($state) => $state.agentStats);
export const isLearningsLoading = derived(mindState, ($state) => $state.learningsLoading);
export const isMemoryConnected = derived(mindState, ($state) => $state.memoryConnected);

/**
 * Load a project's memory/context
 */
export async function loadProject(options?: {
	project_id?: string;
	project_description?: string;
	stack_hints?: string[];
}): Promise<boolean> {
	mindState.update((s) => ({ ...s, loading: true, error: null }));

	try {
		const result = await mcpClient.loadProject(options);

		if (result.success && result.data) {
			mindState.update((s) => ({
				...s,
				project: result.data!,
				loading: false
			}));
			return true;
		} else {
			mindState.update((s) => ({
				...s,
				loading: false,
				error: result.error || 'Failed to load project'
			}));
			return false;
		}
	} catch (e) {
		mindState.update((s) => ({
			...s,
			loading: false,
			error: e instanceof Error ? e.message : 'Unknown error'
		}));
		return false;
	}
}

/**
 * Add a decision to the project
 */
export async function addDecision(what: string, why: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				decision: { what, why }
			},
			state.project.project_id
		);

		if (result.success) {
			// Add locally while we wait for refresh
			const newDecision: MindDecision = {
				what,
				why,
				created_at: new Date().toISOString()
			};

			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							decisions: [newDecision, ...s.project.decisions]
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Add an issue to track
 */
export async function addIssue(description: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				issue: { description, status: 'open' }
			},
			state.project.project_id
		);

		if (result.success) {
			const newIssue: MindIssue = {
				description,
				status: 'open',
				created_at: new Date().toISOString()
			};

			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							issues: [newIssue, ...s.project.issues]
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Resolve an issue
 */
export async function resolveIssue(description: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				issue: { description, status: 'resolved' }
			},
			state.project.project_id
		);

		if (result.success) {
			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							issues: s.project.issues.map((i) =>
								i.description === description ? { ...i, status: 'resolved' as const } : i
							)
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Add a session summary
 */
export async function addSessionSummary(summary: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				session_summary: summary
			},
			state.project.project_id
		);

		if (result.success) {
			const newSession = {
				summary,
				created_at: new Date().toISOString()
			};

			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							sessions: [newSession, ...s.project.sessions]
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Clear mind state
 */
export function clearMindState() {
	mindState.set(initialState);
}

// ============================================
// Memory/Learning Functions (Mind v5)
// ============================================

/**
 * Check if Mind API is connected
 */
export async function checkMemoryConnection(): Promise<boolean> {
	try {
		const connected = await memoryClient.isConnected();
		mindState.update((s) => ({ ...s, memoryConnected: connected }));
		return connected;
	} catch {
		mindState.update((s) => ({ ...s, memoryConnected: false }));
		return false;
	}
}

/**
 * Load agent learnings from Mind
 */
export async function loadLearnings(agentId?: string): Promise<boolean> {
	mindState.update((s) => ({ ...s, learningsLoading: true }));

	try {
		// Get learnings
		const learningsResult = await memoryClient.retrieve('agent learning', {
			limit: 50,
			content_types: ['agent_learning'],
			agent_id: agentId
		});

		// Get patterns
		const patternsResult = await memoryClient.retrieve('workflow pattern', {
			limit: 20,
			content_types: ['workflow_pattern']
		});

		if (learningsResult.success || patternsResult.success) {
			mindState.update((s) => ({
				...s,
				learnings: learningsResult.data?.memories.map((sm) => sm.memory) ?? [],
				patterns: patternsResult.data?.memories.map((sm) => sm.memory) ?? [],
				learningsLoading: false,
				memoryConnected: true
			}));
			return true;
		} else {
			mindState.update((s) => ({
				...s,
				learningsLoading: false,
				error: learningsResult.error ?? 'Failed to load learnings'
			}));
			return false;
		}
	} catch (e) {
		mindState.update((s) => ({
			...s,
			learningsLoading: false,
			memoryConnected: false,
			error: e instanceof Error ? e.message : 'Failed to load learnings'
		}));
		return false;
	}
}

/**
 * Load agent effectiveness stats
 */
export async function loadAgentStats(agentId: string): Promise<boolean> {
	try {
		const result = await memoryClient.getAgentEffectiveness(agentId);

		if (result.success && result.data) {
			mindState.update((s) => ({
				...s,
				agentStats: {
					...s.agentStats,
					[agentId]: result.data!
				}
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Record an agent decision
 */
export async function recordAgentDecision(
	agentId: string,
	agentName: string,
	decision: {
		skillId?: string;
		skillName?: string;
		missionId?: string;
		taskId?: string;
		decision: string;
		reasoning?: string;
		confidence?: number;
		context?: string;
	}
): Promise<string | null> {
	try {
		const result = await memoryClient.recordAgentDecision(agentId, agentName, decision);

		if (result.success && result.data) {
			// Add to local state
			mindState.update((s) => ({
				...s,
				learnings: [result.data!, ...s.learnings]
			}));
			return result.data.memory_id;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Record a task outcome
 */
export async function recordTaskOutcome(
	missionId: string,
	taskId: string,
	outcome: {
		success: boolean;
		details?: string;
		agentId?: string;
		skillId?: string;
	}
): Promise<boolean> {
	try {
		const result = await memoryClient.recordTaskOutcome(missionId, taskId, outcome);
		return result.success;
	} catch {
		return false;
	}
}

/**
 * Record a learning
 */
export async function recordLearning(
	agentId: string,
	learning: {
		content: string;
		skillId?: string;
		missionId?: string;
		patternType: 'success' | 'failure' | 'optimization';
		confidence: number;
	}
): Promise<boolean> {
	try {
		const result = await memoryClient.recordLearning(agentId, learning);

		if (result.success && result.data) {
			mindState.update((s) => ({
				...s,
				learnings: [result.data!, ...s.learnings]
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Record a workflow pattern
 */
export async function recordWorkflowPattern(pattern: {
	name: string;
	description: string;
	skillSequence: string[];
	applicableTo: string[];
	missionId?: string;
}): Promise<boolean> {
	try {
		const result = await memoryClient.recordWorkflowPattern(pattern);

		if (result.success && result.data) {
			mindState.update((s) => ({
				...s,
				patterns: [result.data!, ...s.patterns]
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Get relevant learnings for a task
 */
export async function getRelevantLearnings(
	taskDescription: string,
	options?: { agentId?: string; skillId?: string; limit?: number }
): Promise<Memory[]> {
	try {
		const result = await memoryClient.getRelevantLearnings(taskDescription, options);
		return result.success ? result.data?.map((sm) => sm.memory) ?? [] : [];
	} catch {
		return [];
	}
}

/**
 * Get workflow patterns for a problem type
 */
export async function getWorkflowPatterns(problemType: string): Promise<Memory[]> {
	try {
		const result = await memoryClient.getWorkflowPatterns(problemType);
		return result.success ? result.data ?? [] : [];
	} catch {
		return [];
	}
}
