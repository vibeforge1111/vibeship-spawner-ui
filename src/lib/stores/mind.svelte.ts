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
import type { MindProject } from '$lib/services/mcp-client';
import type { Memory, AgentLearning, WorkflowPattern, AgentEffectiveness, Improvement } from '$lib/types/memory';

// Local types for Mind v5 unified storage
export interface MindDecision {
	id: string;
	what: string;
	why: string;
	created_at: string;
	memory_id?: string;  // Reference to Mind v5 memory
}

export interface MindIssue {
	id: string;
	description: string;
	status: 'open' | 'resolved';
	created_at: string;
	resolved_at?: string;
	memory_id?: string;  // Reference to Mind v5 memory
}

export interface MindSession {
	id: string;
	summary: string;
	created_at: string;
	memory_id?: string;  // Reference to Mind v5 memory
}

export interface MindState {
	project: MindProject | null;
	loading: boolean;
	error: string | null;
	// Agent learning state
	learnings: Memory[];
	patterns: Memory[];
	agentStats: Record<string, AgentEffectiveness>;
	learningsLoading: boolean;
	learningsHasMore: boolean;
	learningsLoadingMore: boolean;
	memoryConnected: boolean;
	// Unified Mind v5 storage
	decisions: MindDecision[];
	issues: MindIssue[];
	sessions: MindSession[];
	decisionsLoading: boolean;
	issuesLoading: boolean;
	sessionsLoading: boolean;
	// Improvements
	improvements: Improvement[];
	improvementsLoading: boolean;
	improvementStats: {
		total: number;
		pending: number;
		applied: number;
		dismissed: number;
		byType: Record<string, number>;
		averageImpact: number;
	} | null;
}

const initialState: MindState = {
	project: null,
	loading: false,
	error: null,
	learnings: [],
	patterns: [],
	agentStats: {},
	learningsLoading: false,
	learningsHasMore: true,
	learningsLoadingMore: false,
	memoryConnected: false,
	// Unified Mind v5 storage
	decisions: [],
	issues: [],
	sessions: [],
	decisionsLoading: false,
	issuesLoading: false,
	sessionsLoading: false,
	// Improvements
	improvements: [],
	improvementsLoading: false,
	improvementStats: null
};

export const mindState = writable<MindState>(initialState);

// Derived stores for convenience
export const currentProject = derived(mindState, ($state) => $state.project);
// Now using unified Mind v5 storage instead of project.decisions/issues/sessions
export const decisions = derived(mindState, ($state) => $state.decisions);
export const issues = derived(mindState, ($state) => $state.issues);
export const openIssues = derived(issues, ($issues) => $issues.filter((i) => i.status === 'open'));
export const resolvedIssues = derived(issues, ($issues) => $issues.filter((i) => i.status === 'resolved'));
export const sessions = derived(mindState, ($state) => $state.sessions);
export const isLoading = derived(mindState, ($state) => $state.loading);
export const hasError = derived(mindState, ($state) => $state.error !== null);
export const isDecisionsLoading = derived(mindState, ($state) => $state.decisionsLoading);
export const isIssuesLoading = derived(mindState, ($state) => $state.issuesLoading);
export const isSessionsLoading = derived(mindState, ($state) => $state.sessionsLoading);

// Learning-related derived stores
export const learnings = derived(mindState, ($state) => $state.learnings);
export const patterns = derived(mindState, ($state) => $state.patterns);
export const agentStats = derived(mindState, ($state) => $state.agentStats);
export const isLearningsLoading = derived(mindState, ($state) => $state.learningsLoading);
export const isMemoryConnected = derived(mindState, ($state) => $state.memoryConnected);

// Improvement-related derived stores
export const improvements = derived(mindState, ($state) => $state.improvements);
export const pendingImprovements = derived(improvements, ($imp) => $imp.filter((i) => i.status === 'pending'));
export const appliedImprovements = derived(improvements, ($imp) => $imp.filter((i) => i.status === 'applied'));
export const improvementStats = derived(mindState, ($state) => $state.improvementStats);
export const isImprovementsLoading = derived(mindState, ($state) => $state.improvementsLoading);

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
 * Load decisions from Mind v5
 */
export async function loadDecisions(): Promise<boolean> {
	mindState.update((s) => ({ ...s, decisionsLoading: true }));

	try {
		const result = await memoryClient.listProjectDecisions(50);

		if (result.success && result.data) {
			const decisions: MindDecision[] = result.data.map((m) => ({
				id: m.memory_id,
				what: m.metadata?.decision_what ?? m.content.split('\n\nReason:')[0] ?? m.content,
				why: m.metadata?.decision_why ?? m.content.split('\n\nReason:')[1] ?? '',
				created_at: m.created_at,
				memory_id: m.memory_id
			}));

			mindState.update((s) => ({
				...s,
				decisions,
				decisionsLoading: false,
				memoryConnected: true
			}));
			return true;
		}

		mindState.update((s) => ({ ...s, decisionsLoading: false }));
		return false;
	} catch (e) {
		mindState.update((s) => ({
			...s,
			decisionsLoading: false,
			error: e instanceof Error ? e.message : 'Failed to load decisions'
		}));
		return false;
	}
}

/**
 * Add a decision (saves to Mind v5)
 */
export async function addDecision(what: string, why: string): Promise<boolean> {
	try {
		const result = await memoryClient.createProjectDecision(what, why);

		if (result.success && result.data) {
			const newDecision: MindDecision = {
				id: result.data.memory_id,
				what,
				why,
				created_at: result.data.created_at,
				memory_id: result.data.memory_id
			};

			mindState.update((s) => ({
				...s,
				decisions: [newDecision, ...s.decisions]
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Load issues from Mind v5
 */
export async function loadIssues(): Promise<boolean> {
	mindState.update((s) => ({ ...s, issuesLoading: true }));

	try {
		const result = await memoryClient.listProjectIssues({ limit: 50 });

		if (result.success && result.data) {
			const issues: MindIssue[] = result.data.map((m) => ({
				id: m.memory_id,
				description: m.content,
				status: m.metadata?.issue_status ?? 'open',
				created_at: m.created_at,
				resolved_at: m.metadata?.issue_resolved_at,
				memory_id: m.memory_id
			}));

			mindState.update((s) => ({
				...s,
				issues,
				issuesLoading: false,
				memoryConnected: true
			}));
			return true;
		}

		mindState.update((s) => ({ ...s, issuesLoading: false }));
		return false;
	} catch (e) {
		mindState.update((s) => ({
			...s,
			issuesLoading: false,
			error: e instanceof Error ? e.message : 'Failed to load issues'
		}));
		return false;
	}
}

/**
 * Add an issue (saves to Mind v5)
 */
export async function addIssue(description: string): Promise<boolean> {
	try {
		const result = await memoryClient.createProjectIssue(description, 'open');

		if (result.success && result.data) {
			const newIssue: MindIssue = {
				id: result.data.memory_id,
				description,
				status: 'open',
				created_at: result.data.created_at,
				memory_id: result.data.memory_id
			};

			mindState.update((s) => ({
				...s,
				issues: [newIssue, ...s.issues]
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Resolve an issue (saves to Mind v5)
 */
export async function resolveIssue(description: string): Promise<boolean> {
	try {
		const result = await memoryClient.updateIssueStatus(description, 'resolved');

		if (result.success) {
			mindState.update((s) => ({
				...s,
				issues: s.issues.map((i) =>
					i.description === description
						? { ...i, status: 'resolved' as const, resolved_at: new Date().toISOString() }
						: i
				)
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Load session summaries from Mind v5
 */
export async function loadSessions(): Promise<boolean> {
	mindState.update((s) => ({ ...s, sessionsLoading: true }));

	try {
		const result = await memoryClient.listSessionSummaries(50);

		if (result.success && result.data) {
			const sessions: MindSession[] = result.data.map((m) => ({
				id: m.memory_id,
				summary: m.content,
				created_at: m.created_at,
				memory_id: m.memory_id
			}));

			mindState.update((s) => ({
				...s,
				sessions,
				sessionsLoading: false,
				memoryConnected: true
			}));
			return true;
		}

		mindState.update((s) => ({ ...s, sessionsLoading: false }));
		return false;
	} catch (e) {
		mindState.update((s) => ({
			...s,
			sessionsLoading: false,
			error: e instanceof Error ? e.message : 'Failed to load sessions'
		}));
		return false;
	}
}

/**
 * Add a session summary (saves to Mind v5)
 */
export async function addSessionSummary(summary: string): Promise<boolean> {
	try {
		const result = await memoryClient.createSessionSummary(summary);

		if (result.success && result.data) {
			const newSession: MindSession = {
				id: result.data.memory_id,
				summary,
				created_at: result.data.created_at,
				memory_id: result.data.memory_id
			};

			mindState.update((s) => ({
				...s,
				sessions: [newSession, ...s.sessions]
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
// Improvement Functions
// ============================================

/**
 * Load improvements from Mind v5
 */
export async function loadImprovements(options?: {
	type?: 'skill' | 'agent' | 'team' | 'pipeline';
	status?: 'pending' | 'applied' | 'dismissed';
}): Promise<boolean> {
	mindState.update((s) => ({ ...s, improvementsLoading: true }));

	try {
		const [improvementsResult, statsResult] = await Promise.all([
			memoryClient.listImprovements(options),
			memoryClient.getImprovementStats()
		]);

		if (improvementsResult.success && improvementsResult.data) {
			const improvements: Improvement[] = improvementsResult.data.map((m) => ({
				id: m.memory_id,
				type: m.metadata?.improvement_type ?? 'skill',
				targetId: m.metadata?.improvement_target_id ?? '',
				targetName: m.metadata?.improvement_target_name ?? 'Unknown',
				suggestion: m.metadata?.improvement_suggestion ?? m.content,
				impact: m.metadata?.improvement_impact ?? 0,
				confidence: m.metadata?.confidence ?? m.effective_salience,
				evidenceCount: m.metadata?.improvement_evidence_count ?? 0,
				status: m.metadata?.improvement_status ?? 'applied', // Auto-apply by default - no approval needed
				sourceMissions: m.metadata?.improvement_source_missions ?? [],
				createdAt: m.created_at,
				appliedAt: m.metadata?.improvement_applied_at,
				memoryId: m.memory_id
			}));

			mindState.update((s) => ({
				...s,
				improvements,
				improvementStats: statsResult.success ? statsResult.data ?? null : null,
				improvementsLoading: false,
				memoryConnected: true
			}));
			return true;
		}

		mindState.update((s) => ({ ...s, improvementsLoading: false }));
		return false;
	} catch (e) {
		mindState.update((s) => ({
			...s,
			improvementsLoading: false,
			error: e instanceof Error ? e.message : 'Failed to load improvements'
		}));
		return false;
	}
}

/**
 * Create a new improvement (manual or extracted)
 */
export async function createImprovement(improvement: {
	type: 'skill' | 'agent' | 'team' | 'pipeline';
	targetId: string;
	targetName: string;
	suggestion: string;
	impact: number;
	confidence: number;
	evidenceCount: number;
	sourceMissions?: string[];
}): Promise<boolean> {
	try {
		const result = await memoryClient.createImprovement(improvement);

		if (result.success && result.data) {
			const newImprovement: Improvement = {
				id: result.data.memory_id,
				type: improvement.type,
				targetId: improvement.targetId,
				targetName: improvement.targetName,
				suggestion: improvement.suggestion,
				impact: improvement.impact,
				confidence: improvement.confidence,
				evidenceCount: improvement.evidenceCount,
				status: 'pending',
				sourceMissions: improvement.sourceMissions ?? [],
				createdAt: result.data.created_at,
				memoryId: result.data.memory_id
			};

			mindState.update((s) => ({
				...s,
				improvements: [newImprovement, ...s.improvements]
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Apply an improvement
 */
export async function applyImprovement(improvementId: string): Promise<boolean> {
	try {
		const result = await memoryClient.updateImprovementStatus(improvementId, 'applied');

		if (result.success) {
			mindState.update((s) => ({
				...s,
				improvements: s.improvements.map((i) =>
					i.id === improvementId || i.memoryId === improvementId
						? { ...i, status: 'applied' as const, appliedAt: new Date().toISOString() }
						: i
				)
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Dismiss an improvement
 */
export async function dismissImprovement(improvementId: string): Promise<boolean> {
	try {
		const result = await memoryClient.updateImprovementStatus(improvementId, 'dismissed');

		if (result.success) {
			mindState.update((s) => ({
				...s,
				improvements: s.improvements.map((i) =>
					i.id === improvementId || i.memoryId === improvementId
						? { ...i, status: 'dismissed' as const }
						: i
				)
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Load all Mind data from Mind v5 (unified loader)
 * This loads learnings, decisions, issues, sessions, and improvements in parallel
 */
export async function loadAllMindData(): Promise<boolean> {
	mindState.update((s) => ({ ...s, loading: true }));

	try {
		// Check connection first
		const connected = await checkMemoryConnection();
		if (!connected) {
			mindState.update((s) => ({
				...s,
				loading: false,
				error: 'Mind v5 API not connected'
			}));
			return false;
		}

		// Load all data in parallel
		const [learningsOk, decisionsOk, issuesOk, sessionsOk, improvementsOk] = await Promise.all([
			loadLearnings(),
			loadDecisions(),
			loadIssues(),
			loadSessions(),
			loadImprovements()
		]);

		mindState.update((s) => ({ ...s, loading: false }));
		return learningsOk || decisionsOk || issuesOk || sessionsOk || improvementsOk;
	} catch (e) {
		mindState.update((s) => ({
			...s,
			loading: false,
			error: e instanceof Error ? e.message : 'Failed to load Mind data'
		}));
		return false;
	}
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

// Pagination constants
const LEARNINGS_PAGE_SIZE = 50;
const LEARNINGS_MAX_LOAD = 500;

/**
 * Load agent learnings from Mind (initial page)
 */
export async function loadLearnings(agentId?: string): Promise<boolean> {
	mindState.update((s) => ({ ...s, learningsLoading: true }));

	try {
		// Get first page of learnings (includes ContentForge analyses)
		const learningsResult = await memoryClient.listByContentType(
			['agent_learning', 'agent_decision', 'task_outcome', 'observation', 'viral_pattern', 'topic_learning'],
			{ limit: LEARNINGS_PAGE_SIZE, agent_id: agentId }
		);

		// Get patterns
		const patternsResult = await memoryClient.listByContentType(
			['workflow_pattern'],
			{ limit: 20 }
		);

		if (learningsResult.success || patternsResult.success) {
			const learnings = learningsResult.data ?? [];
			mindState.update((s) => ({
				...s,
				learnings,
				patterns: patternsResult.data ?? [],
				learningsLoading: false,
				learningsHasMore: learnings.length >= LEARNINGS_PAGE_SIZE,
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
 * Load more learnings (all remaining)
 */
export async function loadMoreLearnings(agentId?: string): Promise<boolean> {
	mindState.update((s) => ({ ...s, learningsLoadingMore: true }));

	try {
		// Load all learnings including ContentForge analyses (up to max)
		const learningsResult = await memoryClient.listByContentType(
			['agent_learning', 'agent_decision', 'task_outcome', 'observation', 'viral_pattern', 'topic_learning'],
			{ limit: LEARNINGS_MAX_LOAD, agent_id: agentId }
		);

		if (learningsResult.success && learningsResult.data) {
			mindState.update((s) => ({
				...s,
				learnings: learningsResult.data ?? [],
				learningsLoadingMore: false,
				learningsHasMore: false  // All loaded
			}));
			return true;
		} else {
			mindState.update((s) => ({
				...s,
				learningsLoadingMore: false,
				error: learningsResult.error ?? 'Failed to load more learnings'
			}));
			return false;
		}
	} catch (e) {
		mindState.update((s) => ({
			...s,
			learningsLoadingMore: false,
			error: e instanceof Error ? e.message : 'Failed to load more learnings'
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
