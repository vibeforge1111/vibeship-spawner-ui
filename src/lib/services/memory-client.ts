/**
 * Memory Client - Unified client for Mind v5 API
 *
 * Features:
 * - Auto-detect backend (Lite vs Standard)
 * - Memory CRUD operations
 * - Decision tracking and outcome recording
 * - Agent-specific learning helpers
 * - Metadata encoding for Lite tier (stores in content as JSON)
 */

import type {
	Memory,
	MemoryCreate,
	ScoredMemory,
	RetrieveOptions,
	ListOptions,
	MemoryListResponse,
	RetrieveResponse,
	StatsResponse,
	HealthResponse,
	DecisionCreate,
	DecisionTrace,
	OutcomeCreate,
	OutcomeResponse,
	AgentLearning,
	WorkflowPattern,
	AgentEffectiveness,
	AgentMemoryMetadata,
	ContentType,
	TemporalLevel
} from '$lib/types/memory';
import { TEMPORAL_LEVELS } from '$lib/types/memory';
import { AgentMemoryMetadataSchema, safeJsonParse } from '$lib/types/schemas';

// ============================================
// LITE+ Types for Decision Tracing
// ============================================

export interface DecisionTraceCreate {
	memoryIds: string[];
	memoryScores?: Record<string, number>;
	decisionType: string;
	decisionSummary: string;
	reasoning?: string;
	confidence?: number;
	sessionId?: string;
}

export interface DecisionTraceResponse {
	trace_id: string;
	user_id: string;
	session_id?: string;
	memory_ids: string[];
	memory_scores?: Record<string, number>;
	decision_type?: string;
	decision_summary?: string;
	confidence: number;
	outcome_quality?: number;
	outcome_signal?: string;
	created_at: string;
	outcome_at?: string;
}

export interface PatternResponse {
	pattern_id: string;
	user_id: string;
	pattern_name?: string;
	description?: string;
	skill_sequence: string[];
	success_rate: number;
	evidence_count: number;
	applicable_to: string[];
	created_at: string;
	updated_at?: string;
}

export interface SelfImprovementMetrics {
	totalDecisions: number;
	decisionsWithOutcomes: number;
	averageQuality: number;
	successRate: number;
	memoriesAttributed: number;
	topPatterns: Array<{
		name: string;
		successRate: number;
		evidenceCount: number;
	}>;
	salienceChanges: {
		totalAdjustments: number;
		netChange: number;
	};
}

// ============================================
// Configuration
// ============================================

export interface MemoryClientConfig {
	backend: 'lite' | 'standard' | 'auto';
	liteEndpoint: string;
	standardEndpoint: string;
	userId: string;
	timeout?: number;
}

export interface MemoryClientResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

const DEFAULT_CONFIG: MemoryClientConfig = {
	backend: 'auto',
	liteEndpoint: 'http://localhost:8080',
	standardEndpoint: 'http://localhost:8080',
	userId: '550e8400-e29b-41d4-a716-446655440000',
	timeout: 10000
};

// ============================================
// Memory Client Class
// ============================================

class MemoryClient {
	private config: MemoryClientConfig;
	private detectedBackend: 'lite' | 'standard' | null = null;
	private connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

	constructor(config?: Partial<MemoryClientConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Configure the client
	 */
	configure(config: Partial<MemoryClientConfig>) {
		this.config = { ...this.config, ...config };
		this.detectedBackend = null;  // Reset detection
		this.connectionStatus = 'disconnected';
	}

	/**
	 * Get current configuration
	 */
	getConfig(): MemoryClientConfig {
		return { ...this.config };
	}

	/**
	 * Get connection status
	 */
	getStatus(): typeof this.connectionStatus {
		return this.connectionStatus;
	}

	/**
	 * Get detected backend type
	 */
	getBackend(): 'lite' | 'standard' | null {
		return this.detectedBackend;
	}

	/**
	 * Get the active endpoint based on backend
	 */
	private getEndpoint(): string {
		if (this.config.backend === 'lite' || this.detectedBackend === 'lite') {
			return this.config.liteEndpoint;
		}
		if (this.config.backend === 'standard' || this.detectedBackend === 'standard') {
			return this.config.standardEndpoint;
		}
		// Default to lite for auto before detection
		return this.config.liteEndpoint;
	}

	/**
	 * Make HTTP request to Mind API
	 */
	private async request<T>(
		method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
		path: string,
		body?: unknown
	): Promise<MemoryClientResult<T>> {
		const endpoint = this.getEndpoint();
		const url = `${endpoint}${path}`;

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

			const options: RequestInit = {
				method,
				headers: {
					'Content-Type': 'application/json'
				},
				signal: controller.signal
			};

			if (body) {
				options.body = JSON.stringify(body);
			}

			const response = await fetch(url, options);
			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorText = await response.text();
				return {
					success: false,
					error: `HTTP ${response.status}: ${errorText}`
				};
			}

			const data = await response.json();
			return { success: true, data };
		} catch (e) {
			if (e instanceof Error && e.name === 'AbortError') {
				return { success: false, error: 'Request timeout' };
			}
			return {
				success: false,
				error: e instanceof Error ? e.message : 'Unknown error'
			};
		}
	}

	// ============================================
	// Connection & Health
	// ============================================

	/**
	 * Check health and detect backend type
	 */
	async checkHealth(): Promise<MemoryClientResult<HealthResponse>> {
		this.connectionStatus = 'connecting';

		// Try lite endpoint first
		const liteResult = await this.request<HealthResponse>('GET', '/health');
		if (liteResult.success && liteResult.data?.status === 'healthy') {
			this.detectedBackend = 'lite';
			this.connectionStatus = 'connected';
			return {
				success: true,
				data: { ...liteResult.data, backend: 'lite' }
			};
		}

		// If backend is auto and lite failed, try standard endpoint
		if (this.config.backend === 'auto' && this.config.standardEndpoint !== this.config.liteEndpoint) {
			const oldEndpoint = this.config.liteEndpoint;
			this.config.liteEndpoint = this.config.standardEndpoint;

			const standardResult = await this.request<HealthResponse>('GET', '/health');
			this.config.liteEndpoint = oldEndpoint;  // Restore

			if (standardResult.success && standardResult.data?.status === 'healthy') {
				this.detectedBackend = 'standard';
				this.connectionStatus = 'connected';
				return {
					success: true,
					data: { ...standardResult.data, backend: 'standard' }
				};
			}
		}

		this.connectionStatus = 'error';
		return {
			success: false,
			error: 'Could not connect to Mind API'
		};
	}

	/**
	 * Check if connected
	 */
	async isConnected(): Promise<boolean> {
		if (this.connectionStatus === 'connected') {
			return true;
		}
		const result = await this.checkHealth();
		return result.success;
	}

	/**
	 * Get database stats
	 */
	async getStats(): Promise<MemoryClientResult<StatsResponse>> {
		return this.request<StatsResponse>('GET', '/v1/stats');
	}

	// ============================================
	// Memory CRUD
	// ============================================

	/**
	 * Create a memory
	 */
	async createMemory(memory: MemoryCreate): Promise<MemoryClientResult<Memory>> {
		// For Lite tier, encode metadata in content as JSON block
		let content = memory.content;
		if (memory.metadata && Object.keys(memory.metadata).length > 0) {
			content = this.encodeMetadata(memory.content, memory.metadata);
		}

		const payload = {
			user_id: memory.user_id ?? this.config.userId,
			content,
			content_type: memory.content_type ?? 'observation',
			temporal_level: memory.temporal_level ?? TEMPORAL_LEVELS.SITUATIONAL,
			salience: memory.salience ?? 0.7
		};

		const result = await this.request<Memory>('POST', '/v1/memories/', payload);

		// Decode metadata from response if present
		if (result.success && result.data) {
			result.data = this.decodeMemoryMetadata(result.data);
		}

		return result;
	}

	/**
	 * Get a memory by ID
	 */
	async getMemory(memoryId: string): Promise<MemoryClientResult<Memory>> {
		const result = await this.request<Memory>('GET', `/v1/memories/${memoryId}`);

		if (result.success && result.data) {
			result.data = this.decodeMemoryMetadata(result.data);
		}

		return result;
	}

	/**
	 * List memories
	 */
	async listMemories(options?: ListOptions): Promise<MemoryClientResult<Memory[]>> {
		const params = new URLSearchParams();
		if (options?.limit) params.set('limit', options.limit.toString());
		if (options?.offset) params.set('offset', options.offset.toString());

		const queryString = params.toString();
		const path = `/v1/memories/${queryString ? `?${queryString}` : ''}`;

		// API returns array directly, not {memories: [...]}
		const result = await this.request<Memory[]>('GET', path);

		// Decode metadata for all memories
		if (result.success && result.data) {
			result.data = result.data.map(m => this.decodeMemoryMetadata(m));
		}

		return result;
	}

	/**
	 * List memories filtered by content type(s)
	 * Better for Lite tier which doesn't have semantic search
	 */
	async listByContentType(
		contentTypes: ContentType[],
		options?: { limit?: number; agent_id?: string }
	): Promise<MemoryClientResult<Memory[]>> {
		// Fetch more than needed since we'll filter client-side
		// For large requests (like "load all"), fetch much more to ensure we get enough after filtering
		const requestedLimit = options?.limit ?? 100;
		const fetchLimit = requestedLimit >= 200 ? requestedLimit * 10 : requestedLimit * 5;
		const result = await this.listMemories({ limit: fetchLimit });

		if (!result.success || !result.data) {
			return { success: false, error: result.error };
		}

		// Filter by content types
		let filtered = result.data.filter(m =>
			m && m.content_type && contentTypes.includes(m.content_type as ContentType)
		);

		// Filter by agent_id if specified
		if (options?.agent_id) {
			filtered = filtered.filter(m =>
				m.metadata?.agent_id === options.agent_id
			);
		}

		// Sort by created_at descending (newest first)
		filtered.sort((a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);

		// Apply limit
		if (options?.limit) {
			filtered = filtered.slice(0, options.limit);
		}

		return { success: true, data: filtered };
	}

	/**
	 * Delete a memory
	 */
	async deleteMemory(memoryId: string): Promise<MemoryClientResult<{ deleted: boolean }>> {
		return this.request<{ deleted: boolean }>('DELETE', `/v1/memories/${memoryId}`);
	}

	/**
	 * Search/retrieve memories
	 */
	async retrieve(query: string, options?: RetrieveOptions): Promise<MemoryClientResult<RetrieveResponse>> {
		const payload = {
			query,
			limit: options?.limit ?? 10
		};

		const result = await this.request<RetrieveResponse>('POST', '/v1/memories/retrieve', payload);

		// Decode metadata and filter by options
		if (result.success && result.data?.memories) {
			let memories = result.data.memories.map(sm => ({
				...sm,
				memory: this.decodeMemoryMetadata(sm.memory)
			}));

			// Filter by content types if specified
			if (options?.content_types?.length) {
				memories = memories.filter(sm =>
					options.content_types!.includes(sm.memory.content_type as ContentType)
				);
			}

			// Filter by agent_id if specified
			if (options?.agent_id) {
				memories = memories.filter(sm =>
					sm.memory.metadata?.agent_id === options.agent_id
				);
			}

			// Filter by skill_id if specified
			if (options?.skill_id) {
				memories = memories.filter(sm =>
					sm.memory.metadata?.skill_id === options.skill_id
				);
			}

			// Filter by mission_id if specified
			if (options?.mission_id) {
				memories = memories.filter(sm =>
					sm.memory.metadata?.mission_id === options.mission_id
				);
			}

			result.data.memories = memories;
		}

		return result;
	}

	// ============================================
	// Metadata Encoding/Decoding (for Lite tier)
	// ============================================

	/**
	 * Encode metadata into content as JSON block
	 * Format: content\n\n---METADATA---\n{json}
	 */
	private encodeMetadata(content: string, metadata: AgentMemoryMetadata): string {
		const metaJson = JSON.stringify(metadata);
		return `${content}\n\n---METADATA---\n${metaJson}`;
	}

	/**
	 * Decode metadata from content
	 */
	private decodeMemoryMetadata(memory: Memory): Memory {
		const separator = '\n\n---METADATA---\n';
		const sepIndex = memory.content.indexOf(separator);

		if (sepIndex === -1) {
			return memory;
		}

		try {
			const content = memory.content.substring(0, sepIndex);
			const metaJson = memory.content.substring(sepIndex + separator.length);
			// SECURITY: Validate JSON with Zod schema
			const metadata = safeJsonParse(metaJson, AgentMemoryMetadataSchema, 'memory-metadata');

			if (!metadata) {
				// If validation fails, return as-is
				return memory;
			}

			return {
				...memory,
				content,
				metadata: metadata as AgentMemoryMetadata
			};
		} catch {
			// If parsing fails, return as-is
			return memory;
		}
	}

	// ============================================
	// Agent Learning Helpers
	// ============================================

	/**
	 * Record an agent decision
	 */
	async recordAgentDecision(
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
	): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: decision.decision,
			content_type: 'agent_decision',
			temporal_level: TEMPORAL_LEVELS.SITUATIONAL,
			salience: decision.confidence ?? 0.7,
			metadata: {
				agent_id: agentId,
				agent_name: agentName,
				skill_id: decision.skillId,
				skill_name: decision.skillName,
				mission_id: decision.missionId,
				task_id: decision.taskId,
				decision_context: decision.context,
				reasoning: decision.reasoning,
				confidence: decision.confidence,
				outcome: 'pending'
			}
		});
	}

	/**
	 * Record a task outcome
	 */
	async recordTaskOutcome(
		missionId: string,
		taskId: string,
		outcome: {
			success: boolean;
			details?: string;
			agentId?: string;
			skillId?: string;
		}
	): Promise<MemoryClientResult<Memory>> {
		const outcomeType = outcome.success ? 'success' : 'failure';
		const salience = outcome.success ? 0.7 : 0.8;  // Failures slightly more salient

		return this.createMemory({
			content: outcome.details || `Task ${taskId} ${outcomeType}`,
			content_type: 'task_outcome',
			temporal_level: TEMPORAL_LEVELS.SITUATIONAL,
			salience,
			metadata: {
				mission_id: missionId,
				task_id: taskId,
				agent_id: outcome.agentId,
				skill_id: outcome.skillId,
				outcome: outcomeType,
				outcome_details: outcome.details
			}
		});
	}

	/**
	 * Extract and store a learning from outcomes
	 */
	async recordLearning(
		agentId: string,
		learning: {
			content: string;
			skillId?: string;
			missionId?: string;
			patternType: 'success' | 'failure' | 'optimization';
			confidence: number;
			sourceDecisions?: string[];
		}
	): Promise<MemoryClientResult<Memory>> {
		// Learnings go to SEASONAL level (longer retention)
		return this.createMemory({
			content: learning.content,
			content_type: 'agent_learning',
			temporal_level: TEMPORAL_LEVELS.SEASONAL,
			salience: learning.confidence,
			metadata: {
				agent_id: agentId,
				skill_id: learning.skillId,
				mission_id: learning.missionId,
				pattern_type: learning.patternType,
				confidence: learning.confidence,
				reinforcement_count: 1
			}
		});
	}

	/**
	 * Record a workflow pattern
	 */
	async recordWorkflowPattern(pattern: {
		name: string;
		description: string;
		skillSequence: string[];
		applicableTo: string[];
		missionId?: string;
	}): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: `${pattern.name}: ${pattern.description}`,
			content_type: 'workflow_pattern',
			temporal_level: TEMPORAL_LEVELS.SEASONAL,
			salience: 0.8,
			metadata: {
				mission_id: pattern.missionId,
				workflow_sequence: pattern.skillSequence,
				applicable_to: pattern.applicableTo
			}
		});
	}

	/**
	 * Record handoff context between agents
	 */
	async recordHandoff(
		fromAgentId: string,
		toAgentId: string,
		context: {
			missionId?: string;
			taskId?: string;
			reason: string;
			context: string;
		}
	): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: context.context,
			content_type: 'handoff_context',
			temporal_level: TEMPORAL_LEVELS.IMMEDIATE,  // Short-lived
			salience: 0.6,
			metadata: {
				from_agent_id: fromAgentId,
				to_agent_id: toAgentId,
				mission_id: context.missionId,
				task_id: context.taskId,
				handoff_reason: context.reason
			}
		});
	}

	/**
	 * Get learnings for an agent
	 */
	async getAgentLearnings(
		agentId: string,
		options?: { limit?: number; skillId?: string }
	): Promise<MemoryClientResult<Memory[]>> {
		const result = await this.retrieve(`agent learning ${agentId}`, {
			limit: options?.limit ?? 20,
			content_types: ['agent_learning'],
			agent_id: agentId,
			skill_id: options?.skillId
		});

		if (result.success && result.data) {
			return {
				success: true,
				data: result.data.memories.map(sm => sm.memory)
			};
		}

		return {
			success: false,
			error: result.error
		};
	}

	/**
	 * Get relevant learnings for a task
	 */
	async getRelevantLearnings(
		taskDescription: string,
		options?: {
			agentId?: string;
			skillId?: string;
			limit?: number;
		}
	): Promise<MemoryClientResult<ScoredMemory[]>> {
		const result = await this.retrieve(taskDescription, {
			limit: options?.limit ?? 10,
			content_types: ['agent_learning', 'workflow_pattern'],
			agent_id: options?.agentId,
			skill_id: options?.skillId
		});

		if (result.success && result.data) {
			return {
				success: true,
				data: result.data.memories
			};
		}

		return {
			success: false,
			error: result.error
		};
	}

	/**
	 * Get workflow patterns for a problem type
	 */
	async getWorkflowPatterns(
		problemType: string,
		limit: number = 5
	): Promise<MemoryClientResult<Memory[]>> {
		const result = await this.retrieve(`workflow pattern ${problemType}`, {
			limit,
			content_types: ['workflow_pattern']
		});

		if (result.success && result.data) {
			// Filter by applicable_to
			const filtered = result.data.memories.filter(sm =>
				sm.memory.metadata?.applicable_to?.some(
					(type: string) => problemType.toLowerCase().includes(type.toLowerCase())
				)
			);

			return {
				success: true,
				data: filtered.map(sm => sm.memory)
			};
		}

		return {
			success: false,
			error: result.error
		};
	}

	/**
	 * Get agent effectiveness metrics
	 * Note: This is calculated client-side for Lite tier
	 */
	async getAgentEffectiveness(agentId: string): Promise<MemoryClientResult<AgentEffectiveness>> {
		// Get all outcomes for this agent
		const outcomes = await this.retrieve(`agent ${agentId}`, {
			limit: 100,
			content_types: ['task_outcome'],
			agent_id: agentId
		});

		if (!outcomes.success || !outcomes.data) {
			return { success: false, error: outcomes.error };
		}

		const memories = outcomes.data.memories.map(sm => sm.memory);

		// Calculate metrics
		let positive = 0;
		let negative = 0;
		const skillStats: Record<string, { success: number; failure: number }> = {};

		for (const memory of memories) {
			const isSuccess = memory.metadata?.outcome === 'success';
			if (isSuccess) {
				positive++;
			} else {
				negative++;
			}

			// Track by skill
			const skillId = memory.metadata?.skill_id;
			if (skillId) {
				if (!skillStats[skillId]) {
					skillStats[skillId] = { success: 0, failure: 0 };
				}
				if (isSuccess) {
					skillStats[skillId].success++;
				} else {
					skillStats[skillId].failure++;
				}
			}
		}

		// Get recent learnings
		const learnings = await this.getAgentLearnings(agentId, { limit: 5 });

		// Build top skills
		const topSkills = Object.entries(skillStats)
			.map(([skillId, stats]) => ({
				skill_id: skillId,
				success_rate: stats.success / (stats.success + stats.failure),
				usage_count: stats.success + stats.failure
			}))
			.sort((a, b) => b.success_rate - a.success_rate)
			.slice(0, 5);

		return {
			success: true,
			data: {
				agent_id: agentId,
				agent_name: agentId,  // Would need to look this up
				total_decisions: positive + negative,
				positive_outcomes: positive,
				negative_outcomes: negative,
				success_rate: positive / (positive + negative) || 0,
				top_skills: topSkills,
				recent_learnings: (learnings.data || []).map(m => ({
					id: m.memory_id,
					agent_id: agentId,
					skill_id: m.metadata?.skill_id,
					content: m.content,
					pattern_type: m.metadata?.pattern_type || 'success',
					confidence: m.metadata?.confidence || m.effective_salience,
					reinforcement_count: m.metadata?.reinforcement_count || 1,
					source_decisions: [],
					created_at: m.created_at
				}))
			}
		};
	}

	// ============================================
	// Project-Level Memory Helpers (for Mind tabs)
	// ============================================

	/**
	 * Create a project decision (for Decisions tab)
	 */
	async createProjectDecision(
		what: string,
		why: string
	): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: `${what}\n\nReason: ${why}`,
			content_type: 'project_decision',
			temporal_level: TEMPORAL_LEVELS.SEASONAL,
			salience: 0.8,
			metadata: {
				decision_what: what,
				decision_why: why
			}
		});
	}

	/**
	 * Get all project decisions
	 */
	async listProjectDecisions(limit: number = 50): Promise<MemoryClientResult<Memory[]>> {
		return this.listByContentType(['project_decision'], { limit });
	}

	/**
	 * Create a project issue (for Issues tab)
	 */
	async createProjectIssue(
		description: string,
		status: 'open' | 'resolved' = 'open'
	): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: description,
			content_type: 'project_issue',
			temporal_level: TEMPORAL_LEVELS.SITUATIONAL,
			salience: status === 'open' ? 0.8 : 0.6,
			metadata: {
				issue_status: status
			}
		});
	}

	/**
	 * Update an issue's status (resolve or reopen)
	 * Note: For Lite tier, we create a new memory with updated status
	 * since there's no update endpoint
	 */
	async updateIssueStatus(
		description: string,
		status: 'open' | 'resolved'
	): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: description,
			content_type: 'project_issue',
			temporal_level: TEMPORAL_LEVELS.SITUATIONAL,
			salience: status === 'open' ? 0.8 : 0.5,
			metadata: {
				issue_status: status,
				issue_resolved_at: status === 'resolved' ? new Date().toISOString() : undefined
			}
		});
	}

	/**
	 * Get all project issues
	 */
	async listProjectIssues(
		options?: { status?: 'open' | 'resolved'; limit?: number }
	): Promise<MemoryClientResult<Memory[]>> {
		const result = await this.listByContentType(['project_issue'], { limit: options?.limit ?? 50 });

		if (!result.success || !result.data) {
			return result;
		}

		let issues = result.data;

		// Deduplicate by description, keeping newest status for each
		const issueMap = new Map<string, Memory>();
		for (const issue of issues) {
			const desc = issue.content;
			const existing = issueMap.get(desc);
			if (!existing || new Date(issue.created_at) > new Date(existing.created_at)) {
				issueMap.set(desc, issue);
			}
		}
		issues = Array.from(issueMap.values());

		// Filter by status if specified
		if (options?.status) {
			issues = issues.filter(i => i.metadata?.issue_status === options.status);
		}

		// Sort by created_at descending
		issues.sort((a, b) =>
			new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);

		return { success: true, data: issues };
	}

	/**
	 * Create a session summary
	 */
	async createSessionSummary(summary: string): Promise<MemoryClientResult<Memory>> {
		return this.createMemory({
			content: summary,
			content_type: 'session_summary',
			temporal_level: TEMPORAL_LEVELS.SITUATIONAL,
			salience: 0.7,
			metadata: {
				session_date: new Date().toISOString()
			}
		});
	}

	/**
	 * Get all session summaries
	 */
	async listSessionSummaries(limit: number = 50): Promise<MemoryClientResult<Memory[]>> {
		return this.listByContentType(['session_summary'], { limit });
	}

	// ============================================
	// Improvement Methods (for Improvements tab)
	// ============================================

	/**
	 * Create an improvement suggestion
	 * Improvements are auto-applied by default (no approval required)
	 */
	async createImprovement(improvement: {
		type: 'skill' | 'agent' | 'team' | 'pipeline';
		targetId: string;
		targetName: string;
		suggestion: string;
		impact: number;
		confidence: number;
		evidenceCount: number;
		sourceMissions?: string[];
		status?: 'pending' | 'applied' | 'dismissed';
	}): Promise<MemoryClientResult<Memory>> {
		const contentType = `${improvement.type}_improvement` as ContentType;

		return this.createMemory({
			content: `[${improvement.targetName}] ${improvement.suggestion}`,
			content_type: contentType,
			temporal_level: TEMPORAL_LEVELS.SEASONAL,
			salience: improvement.confidence,
			metadata: {
				improvement_type: improvement.type,
				improvement_target_id: improvement.targetId,
				improvement_target_name: improvement.targetName,
				improvement_suggestion: improvement.suggestion,
				improvement_impact: improvement.impact,
				improvement_evidence_count: improvement.evidenceCount,
				improvement_status: improvement.status ?? 'applied', // Auto-apply by default
				improvement_source_missions: improvement.sourceMissions,
				improvement_applied_at: improvement.status !== 'pending' ? new Date().toISOString() : undefined,
				confidence: improvement.confidence
			}
		});
	}

	/**
	 * Get all improvements (all types)
	 */
	async listImprovements(options?: {
		type?: 'skill' | 'agent' | 'team' | 'pipeline';
		status?: 'pending' | 'applied' | 'dismissed';
		limit?: number;
	}): Promise<MemoryClientResult<Memory[]>> {
		const contentTypes: ContentType[] = options?.type
			? [`${options.type}_improvement` as ContentType]
			: ['skill_improvement', 'agent_improvement', 'team_improvement', 'pipeline_improvement'];

		const result = await this.listByContentType(contentTypes, { limit: options?.limit ?? 50 });

		if (!result.success || !result.data) {
			return result;
		}

		let improvements = result.data;

		// Filter by status if specified
		if (options?.status) {
			improvements = improvements.filter(i => i.metadata?.improvement_status === options.status);
		}

		// Sort by impact descending (highest impact first)
		improvements.sort((a, b) => {
			const impactA = a.metadata?.improvement_impact ?? 0;
			const impactB = b.metadata?.improvement_impact ?? 0;
			return impactB - impactA;
		});

		return { success: true, data: improvements };
	}

	/**
	 * Update improvement status (apply or dismiss)
	 */
	async updateImprovementStatus(
		memoryId: string,
		status: 'applied' | 'dismissed'
	): Promise<MemoryClientResult<Memory>> {
		// Get the existing improvement
		const existing = await this.getMemory(memoryId);
		if (!existing.success || !existing.data) {
			return { success: false, error: 'Improvement not found' };
		}

		const memory = existing.data;

		// Create updated memory with new status
		// Note: For Lite tier, we create a new memory since there's no update
		return this.createMemory({
			content: memory.content,
			content_type: memory.content_type,
			temporal_level: memory.temporal_level,
			salience: status === 'applied' ? 0.9 : 0.3, // Boost applied, lower dismissed
			metadata: {
				...memory.metadata,
				improvement_status: status,
				improvement_applied_at: status === 'applied' ? new Date().toISOString() : undefined
			}
		});
	}

	/**
	 * Get improvement statistics
	 */
	async getImprovementStats(): Promise<MemoryClientResult<{
		total: number;
		pending: number;
		applied: number;
		dismissed: number;
		byType: Record<string, number>;
		averageImpact: number;
	}>> {
		const result = await this.listImprovements({ limit: 200 });

		if (!result.success || !result.data) {
			return { success: false, error: result.error };
		}

		const improvements = result.data;
		const stats = {
			total: improvements.length,
			pending: 0,
			applied: 0,
			dismissed: 0,
			byType: {} as Record<string, number>,
			averageImpact: 0
		};

		let totalImpact = 0;

		for (const imp of improvements) {
			const status = imp.metadata?.improvement_status ?? 'applied'; // Auto-apply by default
			const type = imp.metadata?.improvement_type ?? 'unknown';
			const impact = imp.metadata?.improvement_impact ?? 0;

			if (status === 'pending') stats.pending++;
			else if (status === 'applied') stats.applied++;
			else if (status === 'dismissed') stats.dismissed++;

			stats.byType[type] = (stats.byType[type] ?? 0) + 1;
			totalImpact += impact;
		}

		stats.averageImpact = improvements.length > 0 ? totalImpact / improvements.length : 0;

		return { success: true, data: stats };
	}

	// ============================================
	// LITE+ Decision Tracing & Attribution
	// ============================================

	/**
	 * Create a LITE+ decision trace linking memories to a decision.
	 * This enables outcome attribution back to source memories.
	 *
	 * @param decision - The decision details including memories that influenced it
	 * @returns The created decision trace with trace_id for later outcome recording
	 */
	async createDecisionTrace(decision: {
		memoryIds: string[];
		memoryScores?: Record<string, number>;
		decisionType: string;
		decisionSummary: string;
		reasoning?: string;
		confidence?: number;
		sessionId?: string;
	}): Promise<MemoryClientResult<DecisionTraceResponse>> {
		const payload = {
			user_id: this.config.userId,
			session_id: decision.sessionId,
			memory_ids: decision.memoryIds,
			memory_scores: decision.memoryScores,
			decision_type: decision.decisionType,
			decision_summary: decision.reasoning
				? `${decision.decisionSummary}\n\nReasoning: ${decision.reasoning}`
				: decision.decisionSummary,
			confidence: decision.confidence ?? 0.7
		};

		return this.request<DecisionTraceResponse>('POST', '/v1/decisions/', payload);
	}

	/**
	 * Record the outcome of a decision and attribute back to source memories.
	 *
	 * Uses the LITE+ formula: delta = quality × contribution × 0.1
	 * where contribution is (memory_score / total_scores)
	 *
	 * @param traceId - The decision trace ID
	 * @param quality - Outcome quality from -1 (very bad) to 1 (very good)
	 * @param signal - What indicated this outcome (e.g., 'user_helpful', 'task_success')
	 */
	async recordDecisionOutcome(
		traceId: string,
		quality: number,
		signal: string
	): Promise<MemoryClientResult<{
		trace_id: string;
		quality: number;
		signal: string;
		attributed_memories: number;
	}>> {
		return this.request('POST', `/v1/decisions/${traceId}/outcome`, {
			quality: Math.max(-1, Math.min(1, quality)),
			signal
		});
	}

	/**
	 * List decision traces for analysis
	 */
	async listDecisionTraces(options?: {
		limit?: number;
		withOutcomes?: boolean;
	}): Promise<MemoryClientResult<DecisionTraceResponse[]>> {
		const params = new URLSearchParams();
		params.set('user_id', this.config.userId);
		if (options?.limit) params.set('limit', options.limit.toString());

		const result = await this.request<DecisionTraceResponse[]>(
			'GET',
			`/v1/decisions/?${params.toString()}`
		);

		if (result.success && result.data && options?.withOutcomes) {
			result.data = result.data.filter(d => d.outcome_quality !== null);
		}

		return result;
	}

	/**
	 * Get a specific decision trace by ID
	 */
	async getDecisionTrace(traceId: string): Promise<MemoryClientResult<DecisionTraceResponse>> {
		return this.request<DecisionTraceResponse>('GET', `/v1/decisions/${traceId}`);
	}

	// ============================================
	// LITE+ Salience Adjustment
	// ============================================

	/**
	 * Directly adjust a memory's salience.
	 * Useful for manual reinforcement or penalization.
	 *
	 * @param memoryId - The memory to adjust
	 * @param delta - Amount to adjust (-1 to 1)
	 */
	async adjustSalience(
		memoryId: string,
		delta: number
	): Promise<MemoryClientResult<{
		memory_id: string;
		previous_salience: number;
		new_salience: number;
		delta_applied: number;
	}>> {
		return this.request('PATCH', `/v1/memories/${memoryId}/salience`, {
			delta: Math.max(-1, Math.min(1, delta))
		});
	}

	/**
	 * Record an outcome for a specific memory and adjust salience.
	 * Simpler alternative to decision tracing when only one memory is involved.
	 *
	 * @param memoryId - The memory to record outcome for
	 * @param positive - Whether the outcome was positive
	 * @param delta - Salience adjustment amount (default 0.05)
	 */
	async recordMemoryOutcome(
		memoryId: string,
		positive: boolean,
		delta: number = 0.05
	): Promise<MemoryClientResult<{
		memory_id: string;
		outcome: 'positive' | 'negative';
		previous_salience: number;
		new_salience: number;
	}>> {
		return this.request('POST', `/v1/memories/${memoryId}/outcome`, {
			positive,
			delta: Math.max(0, Math.min(0.2, delta))
		});
	}

	// ============================================
	// LITE+ Semantic Search
	// ============================================

	/**
	 * Search memories using FTS5 full-text search with salience ranking.
	 * More powerful than basic retrieve - uses BM25 * salience ranking.
	 *
	 * @param query - Search query
	 * @param limit - Max results
	 */
	async semanticSearch(
		query: string,
		limit: number = 10
	): Promise<MemoryClientResult<{
		retrieval_id: string;
		memories: Memory[];
		scores: Record<string, number>;
		latency_ms: number;
	}>> {
		const result = await this.request<{
			retrieval_id: string;
			memories: Memory[];
			scores: Record<string, number>;
			latency_ms: number;
		}>('POST', '/v1/memories/retrieve/semantic', {
			user_id: this.config.userId,
			query,
			limit
		});

		// Decode metadata for all memories
		if (result.success && result.data?.memories) {
			result.data.memories = result.data.memories.map(m => this.decodeMemoryMetadata(m));
		}

		return result;
	}

	// ============================================
	// LITE+ Pattern Extraction
	// ============================================

	/**
	 * Extract patterns from successful decision sequences.
	 * Identifies decision types that frequently succeed.
	 *
	 * @param minOccurrences - Minimum times a pattern must occur
	 */
	async extractPatterns(
		minOccurrences: number = 3
	): Promise<MemoryClientResult<{
		extracted: number;
		user_id: string;
	}>> {
		return this.request('POST', `/v1/patterns/extract?user_id=${this.config.userId}&min_occurrences=${minOccurrences}`);
	}

	/**
	 * List extracted patterns
	 */
	async listPatterns(): Promise<MemoryClientResult<{
		patterns: PatternResponse[];
	}>> {
		return this.request('GET', `/v1/patterns/?user_id=${this.config.userId}`);
	}

	// ============================================
	// LITE+ Self-Improvement Helpers
	// ============================================

	/**
	 * Record a complete learning experience with decision tracing.
	 * This is the key method for self-improvement - it:
	 * 1. Searches for relevant memories
	 * 2. Creates a decision trace linking them
	 * 3. Returns the trace ID for later outcome recording
	 *
	 * @param experience - The learning experience details
	 */
	async recordExperience(experience: {
		taskDescription: string;
		decisionType: string;
		decisionSummary: string;
		reasoning: string;
		confidence: number;
		sessionId?: string;
	}): Promise<MemoryClientResult<{
		traceId: string;
		memoriesUsed: string[];
		memoryScores: Record<string, number>;
	}>> {
		// 1. Find relevant memories using semantic search
		const searchResult = await this.semanticSearch(experience.taskDescription, 5);

		if (!searchResult.success || !searchResult.data?.memories.length) {
			// No relevant memories found - create decision without memory linkage
			const decisionResult = await this.createDecisionTrace({
				memoryIds: [],
				decisionType: experience.decisionType,
				decisionSummary: experience.decisionSummary,
				reasoning: experience.reasoning,
				confidence: experience.confidence,
				sessionId: experience.sessionId
			});

			if (decisionResult.success && decisionResult.data) {
				return {
					success: true,
					data: {
						traceId: decisionResult.data.trace_id,
						memoriesUsed: [],
						memoryScores: {}
					}
				};
			}
			return { success: false, error: decisionResult.error };
		}

		// 2. Extract memory IDs and scores
		const memoriesUsed = searchResult.data.memories.map(m => m.memory_id);
		const memoryScores = searchResult.data.scores;

		// 3. Create decision trace
		const decisionResult = await this.createDecisionTrace({
			memoryIds: memoriesUsed,
			memoryScores,
			decisionType: experience.decisionType,
			decisionSummary: experience.decisionSummary,
			reasoning: experience.reasoning,
			confidence: experience.confidence,
			sessionId: experience.sessionId
		});

		if (decisionResult.success && decisionResult.data) {
			return {
				success: true,
				data: {
					traceId: decisionResult.data.trace_id,
					memoriesUsed,
					memoryScores
				}
			};
		}

		return { success: false, error: decisionResult.error };
	}

	/**
	 * Complete a learning experience by recording the outcome.
	 * This propagates the outcome back to all source memories.
	 *
	 * @param traceId - The trace ID from recordExperience
	 * @param outcome - The outcome details
	 */
	async completeExperience(
		traceId: string,
		outcome: {
			success: boolean;
			quality?: number;
			signal: string;
			learningExtracted?: string;
		}
	): Promise<MemoryClientResult<{
		attributed_memories: number;
		learning_id?: string;
	}>> {
		// Calculate quality: success = positive, failure = negative
		const quality = outcome.quality ?? (outcome.success ? 0.8 : -0.5);

		// 1. Record decision outcome (this triggers attribution)
		const outcomeResult = await this.recordDecisionOutcome(traceId, quality, outcome.signal);

		if (!outcomeResult.success) {
			return { success: false, error: outcomeResult.error };
		}

		let learningId: string | undefined;

		// 2. If learning was extracted, store it
		if (outcome.learningExtracted) {
			const learningResult = await this.createMemory({
				content: outcome.learningExtracted,
				content_type: 'agent_learning',
				temporal_level: TEMPORAL_LEVELS.SEASONAL,
				salience: Math.abs(quality), // Higher quality = higher salience
				metadata: {
					decision_trace_id: traceId,
					outcome_quality: quality,
					outcome_signal: outcome.signal,
					pattern_type: outcome.success ? 'success' : 'failure'
				}
			});

			if (learningResult.success && learningResult.data) {
				learningId = learningResult.data.memory_id;
			}
		}

		// 3. Extract patterns if enough successful decisions
		if (outcome.success) {
			await this.extractPatterns(2);
		}

		return {
			success: true,
			data: {
				attributed_memories: outcomeResult.data?.attributed_memories ?? 0,
				learning_id: learningId
			}
		};
	}

	/**
	 * Get self-improvement metrics for skills, agents, or teams.
	 * Analyzes decision outcomes to calculate improvement over time.
	 */
	async getSelfImprovementMetrics(options?: {
		decisionType?: string;
		timeRange?: 'day' | 'week' | 'month';
	}): Promise<MemoryClientResult<SelfImprovementMetrics>> {
		// Get decisions
		const decisionsResult = await this.listDecisionTraces({ limit: 100 });
		if (!decisionsResult.success || !decisionsResult.data) {
			return { success: false, error: decisionsResult.error };
		}

		const decisions = decisionsResult.data;
		let filteredDecisions = decisions;

		// Filter by type if specified
		if (options?.decisionType) {
			filteredDecisions = decisions.filter(d => d.decision_type === options.decisionType);
		}

		// Calculate metrics
		const withOutcomes = filteredDecisions.filter(d => d.outcome_quality !== null);
		const successful = withOutcomes.filter(d => (d.outcome_quality ?? 0) > 0);
		const avgQuality = withOutcomes.length > 0
			? withOutcomes.reduce((sum, d) => sum + (d.outcome_quality ?? 0), 0) / withOutcomes.length
			: 0;

		// Count attributed memories
		const memoriesAttributed = new Set(
			filteredDecisions.flatMap(d => d.memory_ids)
		).size;

		// Get patterns
		const patternsResult = await this.listPatterns();
		const topPatterns = (patternsResult.data?.patterns ?? [])
			.slice(0, 5)
			.map(p => ({
				name: p.pattern_name ?? p.pattern_id,
				successRate: p.success_rate,
				evidenceCount: p.evidence_count
			}));

		return {
			success: true,
			data: {
				totalDecisions: filteredDecisions.length,
				decisionsWithOutcomes: withOutcomes.length,
				averageQuality: avgQuality,
				successRate: withOutcomes.length > 0 ? successful.length / withOutcomes.length : 0,
				memoriesAttributed,
				topPatterns,
				salienceChanges: {
					totalAdjustments: withOutcomes.length, // Approximation
					netChange: avgQuality * 0.1 * withOutcomes.length // Based on formula
				}
			}
		};
	}
}

// ============================================
// Singleton Instance
// ============================================

export const memoryClient = new MemoryClient();

// Export class for testing or multiple instances
export { MemoryClient };
