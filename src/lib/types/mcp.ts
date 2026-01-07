/**
 * MCP Types for Spawner UI
 *
 * MCPs (Model Context Protocol servers) can:
 * - Feed data to Mind for learning
 * - Be attached to skills for enhanced capabilities
 * - Be part of teams/pipelines
 * - Run independently and provide feedback
 * - Be selected from sidebar and added to workflows
 */

// ============================================
// MCP Definition & Discovery
// ============================================

export type MCPCategory =
	| 'feedback' // Provides feedback data (analytics, security, etc.)
	| 'tool' // Provides tools for agents to use
	| 'data' // Provides data access (databases, APIs)
	| 'integration' // Connects to external services
	| 'automation' // Automates tasks
	| 'monitoring'; // Monitors and reports

export type MCPCapability =
	| 'security_scan' // Vulnerability scanning
	| 'analytics' // Usage/engagement analytics
	| 'code_analysis' // Code quality, complexity
	| 'performance' // Performance metrics
	| 'social_engagement' // Social media metrics
	| 'seo' // Search engine metrics
	| 'database' // Database operations
	| 'file_system' // File operations
	| 'web_search' // Web searching
	| 'web_fetch' // Web content fetching
	| 'image_gen' // Image generation
	| 'video_gen' // Video generation
	| 'audio_gen' // Audio generation
	| 'code_exec' // Code execution
	| 'deployment' // Deployment operations
	| 'notification' // Notifications/alerts
	| 'storage' // Cloud storage
	| 'email' // Email operations
	| 'calendar' // Calendar operations
	| 'crm' // CRM operations
	| 'payment' // Payment processing
	| 'custom'; // Custom capability

export interface MCPTool {
	name: string;
	description: string;
	inputSchema?: Record<string, unknown>;
	outputSchema?: Record<string, unknown>;
}

export interface MCPDefinition {
	id: string;
	name: string;
	description: string;
	version: string;
	author?: string;
	repository?: string;
	documentation?: string;

	// Classification
	category: MCPCategory;
	capabilities: MCPCapability[];
	tags: string[];

	// What it provides
	tools: MCPTool[];
	feedbackTypes?: string[]; // What feedback it can provide to Mind

	// Requirements
	requiresAuth: boolean;
	authType?: 'api_key' | 'oauth' | 'token' | 'none';
	configSchema?: Record<string, unknown>;

	// Compatibility
	compatibleSkills?: string[]; // Skills that work well with this MCP
	recommendedFor?: string[]; // Use cases it's good for
}

// ============================================
// MCP Instance (Connected MCP)
// ============================================

export type MCPConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface MCPConfig {
	[key: string]: string | number | boolean;
}

export interface MCPInstance {
	id: string;
	definitionId: string;
	name: string; // User-customizable name

	// Connection
	status: MCPConnectionStatus;
	endpoint?: string;
	config: MCPConfig;
	lastConnected?: string;
	lastError?: string;

	// Usage tracking
	usageCount: number;
	lastUsed?: string;
	feedbackCount: number; // How many feedback items sent to Mind

	// Attachments
	attachedToSkills: string[]; // Skill IDs this MCP is attached to
	attachedToTeams: string[]; // Team IDs
	attachedToMissions: string[]; // Active mission IDs

	// Settings
	autoFeedback: boolean; // Automatically send feedback to Mind
	feedbackThreshold?: number; // Min confidence to act on
	enabled: boolean;

	createdAt: string;
	updatedAt: string;
}

// ============================================
// MCP Feedback (Data flowing to Mind)
// ============================================

export interface MCPFeedback {
	id: string;
	mcpId: string;
	mcpName: string;

	// What triggered this feedback
	triggerType: 'automatic' | 'manual' | 'scheduled';
	triggeredBy?: string; // Mission ID, skill ID, or user

	// Target of feedback
	targetType: 'output' | 'decision' | 'pattern' | 'skill' | 'team' | 'general';
	targetId?: string;
	targetDescription?: string;

	// The feedback data
	feedbackType: string; // 'security_scan', 'engagement_metrics', etc.
	metrics: Record<string, number | string | boolean>;
	rawData?: unknown;

	// Interpretation
	sentiment: 'positive' | 'neutral' | 'negative';
	summary: string;
	details?: string;
	recommendations?: string[];

	// Impact on Mind
	confidenceImpact: number; // -1.0 to +1.0
	learningsAffected: string[]; // Memory IDs
	newLearningsCreated: string[];

	// Status
	status: 'pending' | 'processed' | 'ignored' | 'error';
	processedAt?: string;
	error?: string;

	createdAt: string;
}

// ============================================
// MCP Registry (Available MCPs)
// ============================================

export interface MCPRegistryEntry {
	definition: MCPDefinition;
	popularity: number; // Usage count across users
	rating?: number; // 0-5
	verified: boolean;
	featured: boolean;
	addedAt: string;
}

// ============================================
// MCP + Skill Integration
// ============================================

export interface SkillMCPBinding {
	skillId: string;
	mcpId: string;
	bindingType: 'required' | 'recommended' | 'optional';
	purpose: string; // Why this MCP is useful for this skill
	autoAttach: boolean; // Automatically attach when skill is used
	toolsUsed: string[]; // Which MCP tools the skill uses
}

// ============================================
// MCP + Team Integration
// ============================================

export interface TeamMCPBinding {
	teamId: string;
	mcpId: string;
	sharedAcrossTeam: boolean; // All team members can use
	purpose: string;
	feedbackAggregation: boolean; // Aggregate feedback across team
}

// ============================================
// MCP in Pipeline
// ============================================

export interface PipelineMCPNode {
	id: string;
	mcpId: string;
	position: { x: number; y: number };

	// What this MCP does in the pipeline
	role: 'input' | 'processor' | 'validator' | 'output' | 'monitor';
	toolsToRun: string[]; // Specific tools to execute

	// Connections
	inputFrom: string[]; // Node IDs that feed into this
	outputTo: string[]; // Node IDs this feeds into

	// Execution
	runCondition?: string; // When to run (always, on_success, on_failure, etc.)
	config?: MCPConfig; // Runtime config overrides
}

// ============================================
// Built-in MCP Definitions
// ============================================

export const BUILTIN_MCPS: MCPDefinition[] = [
	{
		id: 'security-scanner',
		name: 'Security Scanner',
		description: 'Scans code for vulnerabilities using Trivy and Gitleaks',
		version: '1.0.0',
		category: 'feedback',
		capabilities: ['security_scan', 'code_analysis'],
		tags: ['security', 'vulnerabilities', 'code-quality'],
		tools: [
			{
				name: 'scan_vulnerabilities',
				description: 'Scan code for security vulnerabilities'
			},
			{
				name: 'scan_secrets',
				description: 'Scan for exposed secrets and credentials'
			}
		],
		feedbackTypes: ['vulnerability_report', 'secret_detection'],
		requiresAuth: false,
		compatibleSkills: ['backend', 'frontend', 'devops', 'security'],
		recommendedFor: ['code_generation', 'code_review', 'deployment']
	},
	{
		id: 'analytics-tracker',
		name: 'Analytics Tracker',
		description: 'Tracks engagement and usage metrics from various sources',
		version: '1.0.0',
		category: 'feedback',
		capabilities: ['analytics', 'social_engagement'],
		tags: ['analytics', 'metrics', 'engagement', 'tracking'],
		tools: [
			{
				name: 'get_page_analytics',
				description: 'Get page view and engagement metrics'
			},
			{
				name: 'get_social_metrics',
				description: 'Get social media engagement metrics'
			}
		],
		feedbackTypes: ['engagement_metrics', 'traffic_report', 'conversion_data'],
		requiresAuth: true,
		authType: 'api_key',
		compatibleSkills: ['marketing', 'content-strategy', 'seo'],
		recommendedFor: ['marketing_campaigns', 'content_creation', 'product_launch']
	},
	{
		id: 'code-quality',
		name: 'Code Quality Analyzer',
		description: 'Analyzes code quality, complexity, and test coverage',
		version: '1.0.0',
		category: 'feedback',
		capabilities: ['code_analysis', 'performance'],
		tags: ['code-quality', 'testing', 'complexity', 'coverage'],
		tools: [
			{
				name: 'analyze_complexity',
				description: 'Analyze code complexity metrics'
			},
			{
				name: 'check_coverage',
				description: 'Check test coverage'
			},
			{
				name: 'lint_code',
				description: 'Run linting checks'
			}
		],
		feedbackTypes: ['complexity_report', 'coverage_report', 'lint_results'],
		requiresAuth: false,
		compatibleSkills: ['backend', 'frontend', 'testing'],
		recommendedFor: ['code_generation', 'refactoring', 'code_review']
	},
	{
		id: 'web-research',
		name: 'Web Research',
		description: 'Search and fetch web content for research',
		version: '1.0.0',
		category: 'data',
		capabilities: ['web_search', 'web_fetch'],
		tags: ['research', 'web', 'search', 'content'],
		tools: [
			{
				name: 'search_web',
				description: 'Search the web for information'
			},
			{
				name: 'fetch_page',
				description: 'Fetch and parse web page content'
			}
		],
		requiresAuth: false,
		compatibleSkills: ['content-strategy', 'seo', 'marketing', 'research'],
		recommendedFor: ['research', 'content_creation', 'competitive_analysis']
	},
	{
		id: 'image-generator',
		name: 'Image Generator',
		description: 'Generate images using AI models (DALL-E, Midjourney, etc.)',
		version: '1.0.0',
		category: 'tool',
		capabilities: ['image_gen'],
		tags: ['images', 'ai', 'generation', 'creative'],
		tools: [
			{
				name: 'generate_image',
				description: 'Generate an image from a prompt'
			},
			{
				name: 'edit_image',
				description: 'Edit an existing image'
			}
		],
		requiresAuth: true,
		authType: 'api_key',
		compatibleSkills: ['ui-design', 'texture-art', 'marketing', 'content-strategy'],
		recommendedFor: ['design', 'marketing_assets', 'game_art']
	},
	{
		id: 'database-connector',
		name: 'Database Connector',
		description: 'Connect to and query databases',
		version: '1.0.0',
		category: 'data',
		capabilities: ['database'],
		tags: ['database', 'sql', 'data', 'query'],
		tools: [
			{
				name: 'query',
				description: 'Execute a database query'
			},
			{
				name: 'schema',
				description: 'Get database schema information'
			}
		],
		requiresAuth: true,
		authType: 'token',
		configSchema: {
			type: 'object',
			properties: {
				connectionString: { type: 'string' },
				database: { type: 'string' }
			}
		},
		compatibleSkills: ['backend', 'data-pipeline'],
		recommendedFor: ['backend_development', 'data_analysis']
	},
	{
		id: 'deployment-manager',
		name: 'Deployment Manager',
		description: 'Deploy applications to various platforms',
		version: '1.0.0',
		category: 'automation',
		capabilities: ['deployment'],
		tags: ['deployment', 'devops', 'ci-cd', 'hosting'],
		tools: [
			{
				name: 'deploy',
				description: 'Deploy application to target platform'
			},
			{
				name: 'rollback',
				description: 'Rollback to previous deployment'
			},
			{
				name: 'status',
				description: 'Check deployment status'
			}
		],
		feedbackTypes: ['deployment_status', 'health_check'],
		requiresAuth: true,
		authType: 'token',
		compatibleSkills: ['devops', 'backend', 'frontend'],
		recommendedFor: ['deployment', 'ci_cd', 'production_release']
	},
	{
		id: 'seo-analyzer',
		name: 'SEO Analyzer',
		description: 'Analyze and track SEO performance',
		version: '1.0.0',
		category: 'feedback',
		capabilities: ['seo', 'analytics'],
		tags: ['seo', 'search', 'ranking', 'optimization'],
		tools: [
			{
				name: 'analyze_page',
				description: 'Analyze page SEO factors'
			},
			{
				name: 'track_rankings',
				description: 'Track keyword rankings'
			},
			{
				name: 'competitor_analysis',
				description: 'Analyze competitor SEO'
			}
		],
		feedbackTypes: ['seo_score', 'ranking_report', 'optimization_suggestions'],
		requiresAuth: true,
		authType: 'api_key',
		compatibleSkills: ['seo', 'content-strategy', 'marketing'],
		recommendedFor: ['content_creation', 'website_optimization']
	}
];

// ============================================
// Helper Functions
// ============================================

export function getMCPById(id: string): MCPDefinition | undefined {
	return BUILTIN_MCPS.find((m) => m.id === id);
}

export function getMCPsByCategory(category: MCPCategory): MCPDefinition[] {
	return BUILTIN_MCPS.filter((m) => m.category === category);
}

export function getMCPsByCapability(capability: MCPCapability): MCPDefinition[] {
	return BUILTIN_MCPS.filter((m) => m.capabilities.includes(capability));
}

export function getMCPsForSkill(skillId: string): MCPDefinition[] {
	return BUILTIN_MCPS.filter((m) => m.compatibleSkills?.includes(skillId));
}

export function getFeedbackMCPs(): MCPDefinition[] {
	return BUILTIN_MCPS.filter((m) => m.feedbackTypes && m.feedbackTypes.length > 0);
}
