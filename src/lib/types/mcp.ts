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

// ============================================
// Skill-to-MCP Mapping (Top 100 MCPs)
// ============================================

/**
 * Maps skills to their recommended MCPs
 * Based on the Top 100 Essential MCPs analysis
 */
export const SKILL_MCP_MAP: Record<string, { mcps: string[]; priority: 'required' | 'recommended' | 'optional' }[]> = {
	// Version Control & Git
	'git-workflow': [
		{ mcps: ['github', 'gitlab', 'git'], priority: 'required' },
		{ mcps: ['azure-devops', 'bitbucket'], priority: 'optional' }
	],
	'code-review': [
		{ mcps: ['github', 'gitlab'], priority: 'required' },
		{ mcps: ['sonarqube', 'codeclimate'], priority: 'recommended' }
	],
	'ci-cd-pipeline': [
		{ mcps: ['github', 'gitlab', 'azure-devops'], priority: 'required' },
		{ mcps: ['argocd', 'docker'], priority: 'recommended' }
	],

	// Databases
	'postgres-wizard': [
		{ mcps: ['postgresql', 'supabase', 'neon'], priority: 'required' },
		{ mcps: ['pgvector'], priority: 'recommended' }
	],
	'database-architect': [
		{ mcps: ['postgresql', 'mysql', 'mongodb'], priority: 'required' },
		{ mcps: ['sqlite', 'redis'], priority: 'optional' }
	],
	'supabase-backend': [
		{ mcps: ['supabase', 'postgresql'], priority: 'required' }
	],
	'redis-specialist': [
		{ mcps: ['redis', 'upstash'], priority: 'required' }
	],
	'prisma': [
		{ mcps: ['postgresql', 'mysql', 'sqlite'], priority: 'required' }
	],

	// Cloud & Infrastructure
	'aws-serverless': [
		{ mcps: ['aws', 'dynamodb', 'bedrock'], priority: 'required' }
	],
	'gcp-cloud-run': [
		{ mcps: ['gcp', 'bigquery', 'firestore'], priority: 'required' }
	],
	'azure-serverless': [
		{ mcps: ['azure'], priority: 'required' }
	],
	'kubernetes': [
		{ mcps: ['kubernetes', 'helm'], priority: 'required' },
		{ mcps: ['argocd', 'prometheus', 'grafana'], priority: 'recommended' }
	],
	'infrastructure-as-code': [
		{ mcps: ['terraform', 'pulumi'], priority: 'required' },
		{ mcps: ['aws', 'gcp', 'azure'], priority: 'recommended' }
	],
	'devops': [
		{ mcps: ['docker', 'kubernetes', 'terraform'], priority: 'required' },
		{ mcps: ['datadog', 'prometheus', 'grafana'], priority: 'recommended' }
	],
	'docker': [
		{ mcps: ['docker'], priority: 'required' },
		{ mcps: ['kubernetes'], priority: 'recommended' }
	],
	'vercel-deployment': [
		{ mcps: ['vercel'], priority: 'required' },
		{ mcps: ['github'], priority: 'recommended' }
	],

	// AI & LLM
	'llm-architect': [
		{ mcps: ['anthropic', 'openai', 'bedrock'], priority: 'required' },
		{ mcps: ['ollama', 'groq'], priority: 'optional' }
	],
	'prompt-engineer': [
		{ mcps: ['anthropic', 'openai'], priority: 'required' },
		{ mcps: ['langchain'], priority: 'recommended' }
	],
	'rag-implementation': [
		{ mcps: ['pinecone', 'qdrant', 'chroma', 'weaviate'], priority: 'required' },
		{ mcps: ['langchain', 'llamaindex'], priority: 'recommended' },
		{ mcps: ['pgvector'], priority: 'optional' }
	],
	'agent-memory-systems': [
		{ mcps: ['memory', 'mem0', 'zep', 'letta'], priority: 'required' },
		{ mcps: ['qdrant', 'pinecone', 'graphiti'], priority: 'recommended' }
	],
	'ai-agents-architect': [
		{ mcps: ['langchain', 'anthropic', 'openai'], priority: 'required' },
		{ mcps: ['memory', 'pinecone'], priority: 'recommended' }
	],
	'autonomous-agents': [
		{ mcps: ['langchain', 'memory', 'letta'], priority: 'required' }
	],
	'llm-fine-tuning': [
		{ mcps: ['huggingface', 'wandb'], priority: 'required' },
		{ mcps: ['replicate'], priority: 'optional' }
	],
	'mcp-developer': [
		{ mcps: ['github'], priority: 'required' }
	],

	// Frontend & Frameworks
	'sveltekit': [
		{ mcps: ['vercel', 'supabase'], priority: 'recommended' }
	],
	'nextjs-app-router': [
		{ mcps: ['vercel'], priority: 'required' },
		{ mcps: ['supabase', 'postgresql'], priority: 'recommended' }
	],
	'react-patterns': [
		{ mcps: ['codesandbox'], priority: 'optional' }
	],
	'frontend': [
		{ mcps: ['playwright', 'puppeteer'], priority: 'recommended' },
		{ mcps: ['sentry'], priority: 'recommended' }
	],
	'tailwind-css': [
		{ mcps: ['figma'], priority: 'optional' }
	],

	// Testing & Quality
	'testing-strategies': [
		{ mcps: ['playwright', 'puppeteer'], priority: 'required' },
		{ mcps: ['e2b', 'sentry'], priority: 'recommended' }
	],
	'test-architect': [
		{ mcps: ['playwright', 'puppeteer', 'e2b'], priority: 'required' }
	],
	'browser-automation': [
		{ mcps: ['playwright', 'puppeteer', 'browserbase'], priority: 'required' }
	],
	'debugging-master': [
		{ mcps: ['sentry'], priority: 'required' },
		{ mcps: ['datadog', 'grafana'], priority: 'recommended' }
	],

	// Security
	'security': [
		{ mcps: ['snyk', 'semgrep', 'trivy', 'gitleaks'], priority: 'required' },
		{ mcps: ['vault', '1password'], priority: 'recommended' }
	],
	'security-owasp': [
		{ mcps: ['owasp-zap', 'snyk', 'semgrep'], priority: 'required' }
	],

	// Monitoring & Observability
	'observability': [
		{ mcps: ['datadog', 'grafana', 'prometheus'], priority: 'required' },
		{ mcps: ['sentry', 'pagerduty'], priority: 'recommended' }
	],
	'incident-responder': [
		{ mcps: ['pagerduty', 'sentry', 'datadog'], priority: 'required' }
	],

	// Communication
	'slack-bot-builder': [
		{ mcps: ['slack'], priority: 'required' }
	],
	'discord-bot-architect': [
		{ mcps: ['discord'], priority: 'required' }
	],
	'team-communications': [
		{ mcps: ['slack', 'teams', 'discord'], priority: 'recommended' }
	],
	'email-systems': [
		{ mcps: ['email', 'sendgrid'], priority: 'required' }
	],
	'twilio-communications': [
		{ mcps: ['twilio'], priority: 'required' }
	],

	// Data Engineering
	'data-engineer': [
		{ mcps: ['snowflake', 'bigquery', 'databricks'], priority: 'required' },
		{ mcps: ['dbt', 'airbyte'], priority: 'recommended' }
	],

	// Finance & Payments
	'fintech-integration': [
		{ mcps: ['stripe', 'plaid'], priority: 'required' }
	],
	'stripe-integration': [
		{ mcps: ['stripe'], priority: 'required' }
	],
	'plaid-fintech': [
		{ mcps: ['plaid'], priority: 'required' }
	],
	'defi-architect': [
		{ mcps: ['coinbase'], priority: 'recommended' }
	],
	'algorithmic-trading': [
		{ mcps: ['alpaca'], priority: 'required' }
	],

	// Documentation
	'documentation-engineer': [
		{ mcps: ['notion', 'confluence', 'readme', 'mintlify'], priority: 'recommended' }
	],

	// Product & Project
	'product-management': [
		{ mcps: ['linear', 'jira', 'asana'], priority: 'recommended' }
	],

	// Marketing & Content
	'seo': [
		{ mcps: ['serpapi', 'brave-search'], priority: 'recommended' }
	],
	'marketing': [
		{ mcps: ['analytics-tracker'], priority: 'recommended' }
	],
	'content-strategy': [
		{ mcps: ['notion', 'web-research'], priority: 'recommended' }
	],

	// Creative
	'ai-image-generation': [
		{ mcps: ['replicate', 'image-generator'], priority: 'required' }
	],
	'text-to-video': [
		{ mcps: ['replicate'], priority: 'required' }
	]
};

// ============================================
// Top 100 MCP Registry
// ============================================

export interface MCPRegistryItem {
	id: string;
	name: string;
	description: string;
	category: string;
	subcategory: string;
	repository?: string;
	official: boolean;
	popularity: number; // 1-100
	skills: string[];
	capabilities: MCPCapability[];
}

export const TOP_100_MCPS: MCPRegistryItem[] = [
	// Version Control (1-5)
	{ id: 'github', name: 'GitHub MCP', description: 'Repos, PRs, issues, actions, code search', category: 'Development', subcategory: 'Version Control', repository: 'modelcontextprotocol/servers', official: true, popularity: 100, skills: ['git-workflow', 'code-review', 'ci-cd-pipeline'], capabilities: ['code_analysis'] },
	{ id: 'gitlab', name: 'GitLab MCP', description: 'GitLab API - repos, MRs, CI/CD', category: 'Development', subcategory: 'Version Control', official: false, popularity: 85, skills: ['git-workflow', 'ci-cd-pipeline', 'devops'], capabilities: ['code_analysis'] },
	{ id: 'azure-devops', name: 'Azure DevOps MCP', description: 'Azure Repos, pipelines, boards', category: 'Development', subcategory: 'Version Control', official: false, popularity: 75, skills: ['devops', 'ci-cd-pipeline'], capabilities: ['code_analysis'] },
	{ id: 'bitbucket', name: 'Bitbucket MCP', description: 'Atlassian Bitbucket integration', category: 'Development', subcategory: 'Version Control', official: false, popularity: 60, skills: ['git-workflow'], capabilities: ['code_analysis'] },
	{ id: 'git', name: 'Git MCP', description: 'Local git operations', category: 'Development', subcategory: 'Version Control', repository: 'modelcontextprotocol/servers', official: true, popularity: 95, skills: ['git-workflow', 'code-cleanup'], capabilities: ['code_analysis'] },

	// Code Execution (6-10)
	{ id: 'e2b', name: 'E2B MCP', description: 'Sandboxed code execution', category: 'Development', subcategory: 'Code Execution', official: false, popularity: 80, skills: ['testing-strategies', 'debugging-master'], capabilities: ['code_exec'] },
	{ id: 'jupyter', name: 'Jupyter MCP', description: 'Notebook execution', category: 'Development', subcategory: 'Code Execution', official: false, popularity: 75, skills: ['python-craftsman', 'data-science'], capabilities: ['code_exec'] },
	{ id: 'replit', name: 'Replit MCP', description: 'Cloud IDE integration', category: 'Development', subcategory: 'Code Execution', official: false, popularity: 70, skills: [], capabilities: ['code_exec'] },
	{ id: 'codesandbox', name: 'CodeSandbox MCP', description: 'Browser-based dev environments', category: 'Development', subcategory: 'Code Execution', official: false, popularity: 65, skills: ['frontend', 'react-patterns'], capabilities: ['code_exec'] },
	{ id: 'docker', name: 'Docker MCP', description: 'Container management', category: 'Development', subcategory: 'Containers', repository: 'modelcontextprotocol/servers', official: true, popularity: 95, skills: ['docker', 'devops', 'kubernetes'], capabilities: ['deployment'] },

	// Code Analysis (11-15)
	{ id: 'sonarqube', name: 'SonarQube MCP', description: 'Code quality metrics', category: 'Development', subcategory: 'Code Analysis', official: false, popularity: 80, skills: ['code-review', 'security'], capabilities: ['code_analysis'] },
	{ id: 'eslint', name: 'ESLint MCP', description: 'JavaScript linting', category: 'Development', subcategory: 'Code Analysis', official: false, popularity: 75, skills: ['typescript-strict', 'frontend'], capabilities: ['code_analysis'] },
	{ id: 'semgrep', name: 'Semgrep MCP', description: 'Security scanning', category: 'Development', subcategory: 'Code Analysis', official: false, popularity: 85, skills: ['security-owasp', 'code-review'], capabilities: ['security_scan', 'code_analysis'] },
	{ id: 'snyk', name: 'Snyk MCP', description: 'Vulnerability detection', category: 'Development', subcategory: 'Code Analysis', official: false, popularity: 90, skills: ['security', 'devops'], capabilities: ['security_scan'] },
	{ id: 'codeclimate', name: 'CodeClimate MCP', description: 'Maintainability metrics', category: 'Development', subcategory: 'Code Analysis', official: false, popularity: 65, skills: ['code-cleanup', 'code-review'], capabilities: ['code_analysis'] },

	// Documentation (16-20)
	{ id: 'notion', name: 'Notion MCP', description: 'Documentation management', category: 'Development', subcategory: 'Documentation', official: false, popularity: 85, skills: ['documentation-engineer'], capabilities: ['file_system'] },
	{ id: 'confluence', name: 'Confluence MCP', description: 'Enterprise docs', category: 'Development', subcategory: 'Documentation', official: false, popularity: 70, skills: ['documentation-engineer', 'team-communications'], capabilities: ['file_system'] },
	{ id: 'readme', name: 'ReadMe MCP', description: 'API documentation', category: 'Development', subcategory: 'Documentation', official: false, popularity: 60, skills: ['api-design', 'documentation-engineer'], capabilities: ['file_system'] },
	{ id: 'mintlify', name: 'Mintlify MCP', description: 'Doc site generation', category: 'Development', subcategory: 'Documentation', official: false, popularity: 55, skills: ['documentation-engineer'], capabilities: ['file_system'] },
	{ id: 'docusaurus', name: 'Docusaurus MCP', description: 'React doc sites', category: 'Development', subcategory: 'Documentation', official: false, popularity: 50, skills: ['frontend', 'documentation-engineer'], capabilities: ['file_system'] },

	// Relational Databases (21-25)
	{ id: 'postgresql', name: 'PostgreSQL MCP', description: 'Postgres queries, schema', category: 'Databases', subcategory: 'Relational', repository: 'modelcontextprotocol/servers', official: true, popularity: 100, skills: ['postgres-wizard', 'database-architect', 'supabase-backend'], capabilities: ['database'] },
	{ id: 'mysql', name: 'MySQL MCP', description: 'MySQL operations', category: 'Databases', subcategory: 'Relational', official: false, popularity: 80, skills: ['database-architect'], capabilities: ['database'] },
	{ id: 'sqlite', name: 'SQLite MCP', description: 'Local SQLite', category: 'Databases', subcategory: 'Relational', repository: 'modelcontextprotocol/servers', official: true, popularity: 85, skills: ['database-architect', 'prisma'], capabilities: ['database'] },
	{ id: 'supabase', name: 'Supabase MCP', description: 'Full Supabase platform', category: 'Databases', subcategory: 'Platform', official: false, popularity: 90, skills: ['supabase-backend', 'realtime-sync'], capabilities: ['database', 'storage'] },
	{ id: 'neon', name: 'Neon MCP', description: 'Serverless Postgres', category: 'Databases', subcategory: 'Relational', official: false, popularity: 75, skills: ['postgres-wizard', 'neon-postgres'], capabilities: ['database'] },

	// NoSQL (26-30)
	{ id: 'mongodb', name: 'MongoDB MCP', description: 'Document database', category: 'Databases', subcategory: 'NoSQL', official: false, popularity: 85, skills: ['database-architect'], capabilities: ['database'] },
	{ id: 'redis', name: 'Redis MCP', description: 'Cache & data structures', category: 'Databases', subcategory: 'NoSQL', official: false, popularity: 90, skills: ['redis-specialist', 'caching-patterns'], capabilities: ['database'] },
	{ id: 'firestore', name: 'Firestore MCP', description: 'Google Cloud Firestore', category: 'Databases', subcategory: 'NoSQL', official: false, popularity: 70, skills: ['gcp-cloud-run'], capabilities: ['database'] },
	{ id: 'dynamodb', name: 'DynamoDB MCP', description: 'AWS key-value store', category: 'Databases', subcategory: 'NoSQL', official: false, popularity: 75, skills: ['aws-serverless'], capabilities: ['database'] },
	{ id: 'upstash', name: 'Upstash MCP', description: 'Serverless Redis/Kafka', category: 'Databases', subcategory: 'NoSQL', official: false, popularity: 70, skills: ['redis-specialist', 'caching-patterns'], capabilities: ['database'] },

	// Vector Databases (31-35)
	{ id: 'pinecone', name: 'Pinecone MCP', description: 'Vector search', category: 'Databases', subcategory: 'Vector', official: false, popularity: 90, skills: ['rag-implementation', 'semantic-search'], capabilities: ['database'] },
	{ id: 'qdrant', name: 'Qdrant MCP', description: 'Vector similarity', category: 'Databases', subcategory: 'Vector', official: false, popularity: 80, skills: ['rag-implementation', 'agent-memory-systems'], capabilities: ['database'] },
	{ id: 'weaviate', name: 'Weaviate MCP', description: 'Vector + hybrid search', category: 'Databases', subcategory: 'Vector', official: false, popularity: 75, skills: ['rag-implementation'], capabilities: ['database'] },
	{ id: 'chroma', name: 'Chroma MCP', description: 'Embedding database', category: 'Databases', subcategory: 'Vector', official: false, popularity: 85, skills: ['rag-implementation', 'agent-memory-systems'], capabilities: ['database'] },
	{ id: 'pgvector', name: 'pgvector MCP', description: 'Postgres vector extension', category: 'Databases', subcategory: 'Vector', official: false, popularity: 80, skills: ['postgres-wizard', 'rag-implementation'], capabilities: ['database'] },

	// Data Warehouses (36-40)
	{ id: 'snowflake', name: 'Snowflake MCP', description: 'Cloud data warehouse', category: 'Databases', subcategory: 'Warehouse', official: false, popularity: 80, skills: ['data-engineer'], capabilities: ['database'] },
	{ id: 'bigquery', name: 'BigQuery MCP', description: 'Google analytics', category: 'Databases', subcategory: 'Warehouse', official: false, popularity: 85, skills: ['gcp-cloud-run', 'data-engineer'], capabilities: ['database', 'analytics'] },
	{ id: 'databricks', name: 'Databricks MCP', description: 'Unified analytics', category: 'Databases', subcategory: 'Warehouse', official: false, popularity: 75, skills: ['data-engineer'], capabilities: ['database', 'analytics'] },
	{ id: 'dbt', name: 'dbt MCP', description: 'Data transformation', category: 'Databases', subcategory: 'Pipeline', official: false, popularity: 80, skills: ['data-engineer'], capabilities: ['database'] },
	{ id: 'airbyte', name: 'Airbyte MCP', description: 'Data integration', category: 'Databases', subcategory: 'Pipeline', official: false, popularity: 70, skills: ['data-engineer'], capabilities: ['database'] },

	// Cloud Providers (41-45)
	{ id: 'aws', name: 'AWS MCP', description: 'Full AWS SDK access', category: 'Cloud', subcategory: 'Providers', official: false, popularity: 95, skills: ['aws-serverless', 'infrastructure-as-code'], capabilities: ['deployment', 'storage'] },
	{ id: 'gcp', name: 'GCP MCP', description: 'Google Cloud services', category: 'Cloud', subcategory: 'Providers', official: false, popularity: 85, skills: ['gcp-cloud-run', 'infrastructure-as-code'], capabilities: ['deployment', 'storage'] },
	{ id: 'azure', name: 'Azure MCP', description: 'Microsoft Azure', category: 'Cloud', subcategory: 'Providers', official: false, popularity: 80, skills: ['azure-serverless', 'infrastructure-as-code'], capabilities: ['deployment', 'storage'] },
	{ id: 'cloudflare', name: 'Cloudflare MCP', description: 'Edge compute, Workers', category: 'Cloud', subcategory: 'Providers', official: false, popularity: 85, skills: [], capabilities: ['deployment'] },
	{ id: 'vercel', name: 'Vercel MCP', description: 'Deployment platform', category: 'Cloud', subcategory: 'Providers', official: false, popularity: 90, skills: ['vercel-deployment', 'nextjs-app-router'], capabilities: ['deployment'] },

	// Container & Orchestration (46-50)
	{ id: 'kubernetes', name: 'Kubernetes MCP', description: 'K8s cluster management', category: 'Cloud', subcategory: 'Orchestration', official: false, popularity: 90, skills: ['kubernetes', 'devops'], capabilities: ['deployment'] },
	{ id: 'helm', name: 'Helm MCP', description: 'K8s package manager', category: 'Cloud', subcategory: 'Orchestration', official: false, popularity: 75, skills: ['kubernetes', 'infrastructure-architect'], capabilities: ['deployment'] },
	{ id: 'argocd', name: 'ArgoCD MCP', description: 'GitOps deployments', category: 'Cloud', subcategory: 'Orchestration', official: false, popularity: 70, skills: ['devops', 'ci-cd-pipeline'], capabilities: ['deployment'] },
	{ id: 'terraform', name: 'Terraform MCP', description: 'Infrastructure as Code', category: 'Cloud', subcategory: 'IaC', official: false, popularity: 90, skills: ['infrastructure-as-code'], capabilities: ['deployment'] },
	{ id: 'pulumi', name: 'Pulumi MCP', description: 'IaC with real languages', category: 'Cloud', subcategory: 'IaC', official: false, popularity: 70, skills: ['infrastructure-as-code'], capabilities: ['deployment'] },

	// Monitoring (51-55)
	{ id: 'datadog', name: 'Datadog MCP', description: 'Full-stack monitoring', category: 'Cloud', subcategory: 'Monitoring', official: false, popularity: 85, skills: ['observability', 'devops'], capabilities: ['analytics'] },
	{ id: 'grafana', name: 'Grafana MCP', description: 'Dashboards & metrics', category: 'Cloud', subcategory: 'Monitoring', official: false, popularity: 85, skills: ['observability'], capabilities: ['analytics'] },
	{ id: 'prometheus', name: 'Prometheus MCP', description: 'Metrics collection', category: 'Cloud', subcategory: 'Monitoring', official: false, popularity: 80, skills: ['observability', 'kubernetes'], capabilities: ['analytics'] },
	{ id: 'sentry', name: 'Sentry MCP', description: 'Error tracking', category: 'Cloud', subcategory: 'Monitoring', official: false, popularity: 90, skills: ['error-handling', 'debugging-master'], capabilities: ['analytics'] },
	{ id: 'pagerduty', name: 'PagerDuty MCP', description: 'Incident management', category: 'Cloud', subcategory: 'Monitoring', official: false, popularity: 70, skills: ['incident-responder'], capabilities: ['notification'] },

	// LLM Providers (56-60)
	{ id: 'anthropic', name: 'Anthropic MCP', description: 'Claude API access', category: 'AI', subcategory: 'LLM', repository: 'modelcontextprotocol/servers', official: true, popularity: 95, skills: ['llm-architect', 'prompt-engineer'], capabilities: ['custom'] },
	{ id: 'openai', name: 'OpenAI MCP', description: 'GPT models access', category: 'AI', subcategory: 'LLM', official: false, popularity: 95, skills: ['llm-architect', 'prompt-engineer'], capabilities: ['custom'] },
	{ id: 'bedrock', name: 'Bedrock MCP', description: 'AWS AI models', category: 'AI', subcategory: 'LLM', official: false, popularity: 75, skills: ['aws-serverless', 'llm-architect'], capabilities: ['custom'] },
	{ id: 'ollama', name: 'Ollama MCP', description: 'Local LLM running', category: 'AI', subcategory: 'LLM', official: false, popularity: 80, skills: ['llm-architect'], capabilities: ['custom'] },
	{ id: 'groq', name: 'Groq MCP', description: 'Fast inference', category: 'AI', subcategory: 'LLM', official: false, popularity: 70, skills: ['llm-architect'], capabilities: ['custom'] },

	// AI Dev Tools (61-65)
	{ id: 'langchain', name: 'LangChain MCP', description: 'LLM orchestration', category: 'AI', subcategory: 'Framework', official: false, popularity: 85, skills: ['ai-agents-architect', 'rag-implementation'], capabilities: ['custom'] },
	{ id: 'llamaindex', name: 'LlamaIndex MCP', description: 'RAG framework', category: 'AI', subcategory: 'Framework', official: false, popularity: 75, skills: ['rag-implementation'], capabilities: ['custom'] },
	{ id: 'wandb', name: 'Weights & Biases MCP', description: 'ML experiment tracking', category: 'AI', subcategory: 'MLOps', official: false, popularity: 80, skills: ['llm-fine-tuning'], capabilities: ['analytics'] },
	{ id: 'huggingface', name: 'Hugging Face MCP', description: 'Model hub access', category: 'AI', subcategory: 'Framework', official: false, popularity: 85, skills: ['llm-fine-tuning', 'rag-implementation'], capabilities: ['custom'] },
	{ id: 'replicate', name: 'Replicate MCP', description: 'Model deployment', category: 'AI', subcategory: 'MLOps', official: false, popularity: 80, skills: ['ai-image-generation', 'text-to-video'], capabilities: ['image_gen', 'video_gen'] },

	// Memory & Knowledge (66-70)
	{ id: 'memory', name: 'Memory MCP', description: 'Persistent agent memory', category: 'AI', subcategory: 'Memory', repository: 'modelcontextprotocol/servers', official: true, popularity: 85, skills: ['agent-memory-systems'], capabilities: ['database'] },
	{ id: 'mem0', name: 'Mem0 MCP', description: 'User memory layer', category: 'AI', subcategory: 'Memory', official: false, popularity: 75, skills: ['agent-memory-systems'], capabilities: ['database'] },
	{ id: 'graphiti', name: 'Graphiti MCP', description: 'Knowledge graphs', category: 'AI', subcategory: 'Memory', official: false, popularity: 70, skills: ['agent-memory-systems', 'graph-engineer'], capabilities: ['database'] },
	{ id: 'zep', name: 'Zep MCP', description: 'Long-term memory', category: 'AI', subcategory: 'Memory', official: false, popularity: 70, skills: ['agent-memory-systems'], capabilities: ['database'] },
	{ id: 'letta', name: 'Letta MCP', description: 'Stateful agents', category: 'AI', subcategory: 'Memory', official: false, popularity: 65, skills: ['autonomous-agents'], capabilities: ['database'] },

	// Communication (71-80)
	{ id: 'slack', name: 'Slack MCP', description: 'Workspace messaging', category: 'Communication', subcategory: 'Messaging', repository: 'modelcontextprotocol/servers', official: true, popularity: 90, skills: ['team-communications', 'slack-bot-builder'], capabilities: ['notification'] },
	{ id: 'discord', name: 'Discord MCP', description: 'Community platform', category: 'Communication', subcategory: 'Messaging', official: false, popularity: 80, skills: ['discord-bot-architect', 'community-building'], capabilities: ['notification'] },
	{ id: 'email', name: 'Email MCP', description: 'SMTP/IMAP access', category: 'Communication', subcategory: 'Email', official: false, popularity: 75, skills: ['email-systems'], capabilities: ['email'] },
	{ id: 'twilio', name: 'Twilio MCP', description: 'SMS/Voice', category: 'Communication', subcategory: 'SMS', official: false, popularity: 80, skills: ['twilio-communications'], capabilities: ['notification'] },
	{ id: 'sendgrid', name: 'SendGrid MCP', description: 'Transactional email', category: 'Communication', subcategory: 'Email', official: false, popularity: 75, skills: ['email-systems'], capabilities: ['email'] },
	{ id: 'linear', name: 'Linear MCP', description: 'Issue tracking', category: 'Communication', subcategory: 'Project', official: false, popularity: 75, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'jira', name: 'Jira MCP', description: 'Project management', category: 'Communication', subcategory: 'Project', official: false, popularity: 80, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'asana', name: 'Asana MCP', description: 'Task management', category: 'Communication', subcategory: 'Project', official: false, popularity: 65, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'teams', name: 'Microsoft Teams MCP', description: 'Enterprise chat', category: 'Communication', subcategory: 'Messaging', official: false, popularity: 75, skills: ['team-communications'], capabilities: ['notification'] },
	{ id: 'zoom', name: 'Zoom MCP', description: 'Video conferencing', category: 'Communication', subcategory: 'Video', official: false, popularity: 70, skills: ['team-communications'], capabilities: ['custom'] },

	// Browser & Web (81-90)
	{ id: 'puppeteer', name: 'Puppeteer MCP', description: 'Browser automation', category: 'Browser', subcategory: 'Automation', repository: 'modelcontextprotocol/servers', official: true, popularity: 90, skills: ['browser-automation', 'testing-strategies'], capabilities: ['web_fetch'] },
	{ id: 'playwright', name: 'Playwright MCP', description: 'Cross-browser testing', category: 'Browser', subcategory: 'Automation', official: false, popularity: 90, skills: ['browser-automation', 'testing-strategies'], capabilities: ['web_fetch'] },
	{ id: 'browserbase', name: 'Browserbase MCP', description: 'Cloud browsers', category: 'Browser', subcategory: 'Automation', official: false, popularity: 70, skills: ['browser-automation'], capabilities: ['web_fetch'] },
	{ id: 'firecrawl', name: 'Firecrawl MCP', description: 'Web scraping', category: 'Browser', subcategory: 'Scraping', official: false, popularity: 80, skills: [], capabilities: ['web_fetch'] },
	{ id: 'exa', name: 'Exa MCP', description: 'AI-powered search', category: 'Browser', subcategory: 'Search', official: false, popularity: 75, skills: [], capabilities: ['web_search'] },
	{ id: 'tavily', name: 'Tavily MCP', description: 'Research search', category: 'Browser', subcategory: 'Search', official: false, popularity: 75, skills: [], capabilities: ['web_search'] },
	{ id: 'brave-search', name: 'Brave Search MCP', description: 'Privacy search', category: 'Browser', subcategory: 'Search', official: false, popularity: 70, skills: [], capabilities: ['web_search'] },
	{ id: 'perplexity', name: 'Perplexity MCP', description: 'AI search', category: 'Browser', subcategory: 'Search', official: false, popularity: 75, skills: [], capabilities: ['web_search'] },
	{ id: 'serpapi', name: 'SerpAPI MCP', description: 'Google search API', category: 'Browser', subcategory: 'Search', official: false, popularity: 70, skills: ['seo'], capabilities: ['web_search'] },
	{ id: 'screenshot', name: 'Screenshot MCP', description: 'Page capture', category: 'Browser', subcategory: 'Automation', official: false, popularity: 65, skills: ['browser-automation'], capabilities: ['web_fetch'] },

	// Finance (91-95)
	{ id: 'stripe', name: 'Stripe MCP', description: 'Payment processing', category: 'Finance', subcategory: 'Payments', official: false, popularity: 95, skills: ['fintech-integration', 'stripe-integration'], capabilities: ['payment'] },
	{ id: 'plaid', name: 'Plaid MCP', description: 'Banking connections', category: 'Finance', subcategory: 'Banking', official: false, popularity: 85, skills: ['fintech-integration', 'plaid-fintech'], capabilities: ['payment'] },
	{ id: 'coinbase', name: 'Coinbase MCP', description: 'Crypto trading', category: 'Finance', subcategory: 'Crypto', official: false, popularity: 70, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'quickbooks', name: 'QuickBooks MCP', description: 'Accounting', category: 'Finance', subcategory: 'Accounting', official: false, popularity: 60, skills: [], capabilities: ['custom'] },
	{ id: 'alpaca', name: 'Alpaca MCP', description: 'Stock trading', category: 'Finance', subcategory: 'Trading', official: false, popularity: 65, skills: ['algorithmic-trading'], capabilities: ['payment'] },

	// Security (96-100)
	{ id: 'vault', name: 'Vault MCP', description: 'Secrets management', category: 'Security', subcategory: 'Secrets', official: false, popularity: 85, skills: ['security', 'devops'], capabilities: ['security_scan'] },
	{ id: '1password', name: '1Password MCP', description: 'Password vault', category: 'Security', subcategory: 'Secrets', official: false, popularity: 80, skills: ['security'], capabilities: ['security_scan'] },
	{ id: 'owasp-zap', name: 'OWASP ZAP MCP', description: 'Security scanning', category: 'Security', subcategory: 'Scanning', official: false, popularity: 75, skills: ['security-owasp'], capabilities: ['security_scan'] },
	{ id: 'trivy', name: 'Trivy MCP', description: 'Container scanning', category: 'Security', subcategory: 'Scanning', official: false, popularity: 85, skills: ['docker', 'security'], capabilities: ['security_scan'] },
	{ id: 'gitleaks', name: 'Gitleaks MCP', description: 'Secret detection', category: 'Security', subcategory: 'Scanning', official: false, popularity: 80, skills: ['security', 'git-workflow'], capabilities: ['security_scan'] }
];

// Helper to get MCPs for a skill
export function getMCPsForSkillFromRegistry(skillId: string): MCPRegistryItem[] {
	return TOP_100_MCPS.filter(mcp => mcp.skills.includes(skillId));
}

// Helper to get skills for an MCP
export function getSkillsForMCP(mcpId: string): string[] {
	const mcp = TOP_100_MCPS.find(m => m.id === mcpId);
	return mcp?.skills || [];
}

// Helper to get MCPs by category
export function getMCPsByRegistryCategory(category: string): MCPRegistryItem[] {
	return TOP_100_MCPS.filter(mcp => mcp.category === category);
}

// Get all unique MCP categories
export function getMCPCategories(): string[] {
	return [...new Set(TOP_100_MCPS.map(mcp => mcp.category))];
}

// Get official MCPs only
export function getOfficialMCPs(): MCPRegistryItem[] {
	return TOP_100_MCPS.filter(mcp => mcp.official);
}
