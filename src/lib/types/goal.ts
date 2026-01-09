/**
 * Goal-to-Workflow Type Definitions
 */

export type InputType = 'quick' | 'short' | 'paragraph' | 'long' | 'technical' | 'vague';

export interface ValidationResult {
	valid: boolean;
	sanitized: string;
	error?: string;
	warnings: string[];
}

export interface AnalyzedGoal {
	original: string;
	sanitized: string;
	inputType: InputType;
	keywords: string[];
	technologies: string[];
	features: string[];
	domains: string[];
	confidence: number;
	needsClarification: boolean;
	clarificationPrompt?: string;
}

export interface MatchedSkill {
	skillId: string;
	name: string;
	description: string;
	category: string;
	score: number;
	matchReason: string;
	tier: 1 | 2 | 3; // 1=essential, 2=recommended, 3=optional
	tags?: string[];
}

export interface ClaudeAnalysis {
	technologies: string[];
	features: string[];
	domains: string[];
	suggestedSkills: string[];
	complexity: 'simple' | 'moderate' | 'complex';
	summary: string;
	questions?: string[];
}

export interface MatchResult {
	skills: MatchedSkill[];
	totalMatches: number;
	processingTime: number;
	source: 'claude' | 'mcp' | 'local' | 'hybrid';
	goal: AnalyzedGoal;
	claudeAnalysis?: ClaudeAnalysis;
}

export interface GeneratedWorkflow {
	nodes: Array<{
		skillId: string;
		name: string;
		position: { x: number; y: number };
		tier: 1 | 2 | 3;
	}>;
	connections: Array<{
		sourceId: string;
		targetId: string;
	}>;
	goalContext: {
		original: string;
		summary: string;
	};
}

export interface GoalProcessingState {
	status: 'idle' | 'analyzing' | 'matching' | 'generating' | 'complete' | 'error';
	progress: number;
	message: string;
	error?: string;
}

// Validation constants
export const GOAL_VALIDATION = {
	MIN_LENGTH: 3,
	MAX_LENGTH: 10000,
	MIN_WORDS_FOR_CONFIDENCE: 3,
	MAX_SKILLS_TO_SUGGEST: 50, // Allow up to 50 skills for complex PRDs (470 H70 skills available)
	MIN_CONFIDENCE_SCORE: 0.3,
	VAGUE_INPUT_THRESHOLD: 0.4
} as const;

/**
 * Calculate dynamic skill limit based on PRD complexity
 * @param wordCount - Number of words in PRD
 * @param featureCount - Number of detected features
 * @returns Recommended max skills (8-50 range, 470 H70 skills available)
 */
export function getDynamicSkillLimit(wordCount: number, featureCount: number): number {
	// Base: 10 skills for simple PRDs
	// Scale up based on complexity - allow up to 50 for complex PRDs
	const baseSkills = 10;
	const wordBonus = Math.floor(wordCount / 100); // +1 skill per 100 words (was 200)
	const featureBonus = featureCount; // +1 skill per feature (was /2)

	const calculated = baseSkills + wordBonus + featureBonus;
	return Math.min(GOAL_VALIDATION.MAX_SKILLS_TO_SUGGEST, Math.max(10, calculated));
}
