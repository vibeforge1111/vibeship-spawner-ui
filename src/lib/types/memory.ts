/**
 * Memory Types - For Mind v5 Integration
 *
 * Supports agent learning through:
 * - Decision tracking
 * - Outcome recording
 * - Learning extraction
 * - Workflow pattern detection
 */

// ============================================
// Core Memory Types (from Mind v5)
// ============================================

/**
 * Temporal levels for memory persistence
 * Higher levels = longer retention
 */
export type TemporalLevel = 1 | 2 | 3 | 4;

export const TEMPORAL_LEVELS = {
	IMMEDIATE: 1 as TemporalLevel,    // Session/working memory (hours)
	SITUATIONAL: 2 as TemporalLevel,  // Task/project context (days-weeks)
	SEASONAL: 3 as TemporalLevel,     // Recurring patterns (weeks-months)
	IDENTITY: 4 as TemporalLevel      // Core knowledge (permanent)
} as const;

export const TEMPORAL_LEVEL_NAMES: Record<TemporalLevel, string> = {
	1: 'Immediate',
	2: 'Situational',
	3: 'Seasonal',
	4: 'Identity'
};

/**
 * Standard content types from Mind v5
 */
export type BaseContentType =
	| 'fact'
	| 'preference'
	| 'event'
	| 'goal'
	| 'observation';

/**
 * Extended content types for agent learning
 */
export type AgentContentType =
	| 'agent_decision'     // Decision made by an agent during mission
	| 'agent_learning'     // Insight extracted from outcomes
	| 'workflow_pattern'   // Successful workflow sequence
	| 'task_outcome'       // Result of a task execution
	| 'handoff_context'    // Context passed between agents
	| 'skill_insight';     // Learning about a specific skill

export type ContentType = BaseContentType | AgentContentType;

// ============================================
// Memory Model
// ============================================

/**
 * Memory as returned from Mind API
 */
export interface Memory {
	memory_id: string;
	user_id: string;
	content: string;
	content_type: ContentType;
	temporal_level: TemporalLevel;
	temporal_level_name: string;
	effective_salience: number;
	salience?: number;  // Alias for effective_salience in some contexts
	retrieval_count: number;
	decision_count: number;
	positive_outcomes: number;
	negative_outcomes: number;
	created_at: string;
	// Extended metadata (stored in content as JSON for Lite tier)
	metadata?: AgentMemoryMetadata;
}

/**
 * Create a new memory
 */
export interface MemoryCreate {
	user_id?: string;  // Uses default if not provided
	content: string;
	content_type?: ContentType;
	temporal_level?: TemporalLevel;
	salience?: number;
	metadata?: AgentMemoryMetadata;
}

/**
 * Memory with retrieval scores
 */
export interface ScoredMemory {
	memory: Memory;
	score: number;
	vector_score?: number;
	keyword_score?: number;
	recency_score?: number;
	salience_score?: number;
}

// ============================================
// Agent Learning Metadata
// ============================================

/**
 * Extended metadata for agent memories
 */
export interface AgentMemoryMetadata {
	// Agent context
	agent_id?: string;
	agent_name?: string;
	skill_id?: string;
	skill_name?: string;

	// Mission context
	mission_id?: string;
	mission_name?: string;
	task_id?: string;
	task_title?: string;
	pipeline_id?: string;

	// Decision tracking
	decision_context?: string;   // What was the situation
	reasoning?: string;          // Why this decision was made
	confidence?: number;         // 0.0-1.0 confidence in decision
	alternatives?: string[];     // Other options considered

	// Outcome tracking
	outcome?: 'success' | 'failure' | 'partial' | 'pending';
	outcome_details?: string;
	outcome_quality?: number;    // -1.0 to 1.0

	// Learning extraction
	lesson_learned?: string;
	pattern_type?: 'success' | 'failure' | 'optimization';
	reinforcement_count?: number;  // How many times confirmed

	// Workflow patterns
	workflow_sequence?: string[];  // Skill/task IDs in order
	applicable_to?: string[];      // Problem types this applies to

	// Handoff context
	from_agent_id?: string;
	to_agent_id?: string;
	handoff_reason?: string;

	// Goal context
	goal_summary?: string;

	// Multiple skills (for workflows)
	skill_ids?: string[];
	skill_count?: number;

	// Pipeline context
	connection_count?: number;
	node_count?: number;
}

// ============================================
// Decision Tracking
// ============================================

/**
 * Track a decision made during mission execution
 */
export interface DecisionCreate {
	agent_id: string;
	skill_id?: string;
	mission_id?: string;
	task_id?: string;
	session_id?: string;
	decision_summary: string;
	reasoning?: string;
	confidence?: number;
	memory_ids?: string[];         // Memories that influenced this decision
	memory_scores?: Record<string, number>;  // Retrieval scores
}

/**
 * Decision trace from Mind API
 */
export interface DecisionTrace {
	trace_id: string;
	user_id: string;
	session_id: string;
	memory_ids: string[];
	memory_scores: Record<string, number>;
	decision_type: string;
	decision_summary: string;
	confidence: number;
	alternatives_count: number;
	outcome_observed: boolean;
	outcome_quality?: number;
	outcome_timestamp?: string;
	outcome_signal?: string;
	created_at: string;
}

// ============================================
// Outcome Recording
// ============================================

/**
 * Outcome signal types
 */
export type OutcomeSignal =
	| 'task_succeeded'
	| 'task_failed'
	| 'user_approved'
	| 'user_rejected'
	| 'implicit_acceptance'
	| 'timeout'
	| 'error';

/**
 * Record an outcome for a decision
 */
export interface OutcomeCreate {
	trace_id: string;
	quality: number;           // -1.0 (bad) to 1.0 (good)
	signal: OutcomeSignal;
	feedback?: string;         // Optional user/system feedback
}

/**
 * Outcome response
 */
export interface OutcomeResponse {
	success: boolean;
	memories_updated: number;
	salience_changes: Record<string, number>;  // memory_id -> delta
}

// ============================================
// Agent Learning Types
// ============================================

/**
 * A learning extracted from agent experience
 */
export interface AgentLearning {
	id: string;
	agent_id: string;
	skill_id?: string;
	content: string;
	pattern_type: 'success' | 'failure' | 'optimization';
	confidence: number;
	reinforcement_count: number;
	source_decisions: string[];  // Decision trace IDs
	created_at: string;
	last_reinforced?: string;
}

/**
 * A workflow pattern extracted from successful missions
 */
export interface WorkflowPattern {
	id: string;
	name: string;
	description: string;
	skill_sequence: string[];
	success_count: number;
	failure_count: number;
	applicable_to: string[];  // Problem types
	created_at: string;
	last_used?: string;
}

/**
 * Agent effectiveness metrics
 */
export interface AgentEffectiveness {
	agent_id: string;
	agent_name: string;
	total_decisions: number;
	positive_outcomes: number;
	negative_outcomes: number;
	success_rate: number;
	top_skills: Array<{
		skill_id: string;
		success_rate: number;
		usage_count: number;
	}>;
	recent_learnings: AgentLearning[];
	// Aliases for UI component compatibility
	totalTasks?: number;
	successfulTasks?: number;
	failedTasks?: number;
	totalLearnings?: number;
	topSkills?: string[];
}

// ============================================
// Retrieval Options
// ============================================

/**
 * Options for memory retrieval
 */
export interface RetrieveOptions {
	limit?: number;
	temporal_levels?: TemporalLevel[];
	content_types?: ContentType[];
	min_salience?: number;
	agent_id?: string;           // Filter by agent
	skill_id?: string;           // Filter by skill
	mission_id?: string;         // Filter by mission
	include_metadata?: boolean;  // Parse metadata from content
}

/**
 * Options for listing memories
 */
export interface ListOptions {
	limit?: number;
	offset?: number;
	temporal_level?: TemporalLevel;
	content_type?: ContentType;
	min_salience?: number;
}

// ============================================
// API Response Types
// ============================================

export interface MemoryListResponse {
	memories: Memory[];
	count: number;
	limit: number;
	offset: number;
}

export interface RetrieveResponse {
	retrieval_id: string;
	memories: ScoredMemory[];
	query: string;
	latency_ms: number;
}

export interface StatsResponse {
	total_memories: number;
	memories_by_level: Record<TemporalLevel, number>;
	memories_by_type: Record<string, number>;
	average_salience: number;
}

export interface HealthResponse {
	status: 'healthy' | 'unhealthy';
	version: string;
	backend?: 'lite' | 'standard';
}

// ============================================
// Settings Types
// ============================================

/**
 * Learning granularity setting
 * - everything: Record all decisions and outcomes (no threshold)
 * - almost-everything: Record decisions with confidence >= 0.25
 * - moderate: Record decisions with confidence >= 0.5
 * - significant: Only high-confidence (>= 0.7) decisions
 * - manual: User must explicitly mark what to record
 */
export type LearningGranularity = 'everything' | 'almost-everything' | 'moderate' | 'significant' | 'manual';

/**
 * Memory/Mind settings
 */
export interface MemorySettings {
	enabled: boolean;
	backend: 'lite' | 'standard' | 'auto';
	liteEndpoint: string;
	standardEndpoint: string;
	userId: string;
	learningGranularity: LearningGranularity;
	autoExtractPatterns: boolean;
	syncLearnings: boolean;  // Broadcast via sync client
}

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
	enabled: true,
	backend: 'auto',
	liteEndpoint: 'http://localhost:8080',
	standardEndpoint: 'http://localhost:8080',
	userId: '550e8400-e29b-41d4-a716-446655440000',  // Default Mind user
	learningGranularity: 'significant',
	autoExtractPatterns: true,
	syncLearnings: true
};
