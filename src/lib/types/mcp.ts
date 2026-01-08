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

export interface MCPTool {
	name: string;
	description?: string;
	inputSchema?: Record<string, unknown>;
}

export interface MCPServerInfo {
	name: string;
	version: string;
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

	// Server info (populated after connection)
	serverInfo?: MCPServerInfo;
	tools?: MCPTool[];

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
	// ============================================
	// Test Server (Local - No Auth Required)
	// ============================================
	{ id: 'test-server', name: 'Test MCP Server', description: 'Local test server with echo, time, random number, and add tools. No auth required!', category: 'Development', subcategory: 'Testing', official: false, popularity: 100, skills: ['testing-strategies'], capabilities: ['custom'] },

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
	{ id: 'gitleaks', name: 'Gitleaks MCP', description: 'Secret detection', category: 'Security', subcategory: 'Scanning', official: false, popularity: 80, skills: ['security', 'git-workflow'], capabilities: ['security_scan'] },

	// ============================================
	// Productivity (101-115)
	// ============================================
	{ id: 'google-drive', name: 'Google Drive MCP', description: 'File storage and collaboration', category: 'Productivity', subcategory: 'Storage', repository: 'modelcontextprotocol/servers', official: true, popularity: 95, skills: ['documentation-engineer'], capabilities: ['file_system', 'storage'] },
	{ id: 'dropbox', name: 'Dropbox MCP', description: 'Cloud file storage', category: 'Productivity', subcategory: 'Storage', official: false, popularity: 80, skills: [], capabilities: ['file_system', 'storage'] },
	{ id: 'onedrive', name: 'OneDrive MCP', description: 'Microsoft cloud storage', category: 'Productivity', subcategory: 'Storage', official: false, popularity: 75, skills: [], capabilities: ['file_system', 'storage'] },
	{ id: 'box', name: 'Box MCP', description: 'Enterprise file sharing', category: 'Productivity', subcategory: 'Storage', official: false, popularity: 65, skills: [], capabilities: ['file_system', 'storage'] },
	{ id: 'google-calendar', name: 'Google Calendar MCP', description: 'Calendar and scheduling', category: 'Productivity', subcategory: 'Calendar', official: false, popularity: 90, skills: [], capabilities: ['calendar'] },
	{ id: 'outlook-calendar', name: 'Outlook Calendar MCP', description: 'Microsoft calendar', category: 'Productivity', subcategory: 'Calendar', official: false, popularity: 75, skills: [], capabilities: ['calendar'] },
	{ id: 'todoist', name: 'Todoist MCP', description: 'Task management', category: 'Productivity', subcategory: 'Tasks', official: false, popularity: 80, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'airtable', name: 'Airtable MCP', description: 'Spreadsheet-database hybrid', category: 'Productivity', subcategory: 'Database', official: false, popularity: 85, skills: ['no-code-builder'], capabilities: ['database'] },
	{ id: 'google-sheets', name: 'Google Sheets MCP', description: 'Spreadsheet operations', category: 'Productivity', subcategory: 'Spreadsheet', official: false, popularity: 90, skills: ['data-engineer'], capabilities: ['database'] },
	{ id: 'excel', name: 'Microsoft Excel MCP', description: 'Excel automation', category: 'Productivity', subcategory: 'Spreadsheet', official: false, popularity: 80, skills: ['data-engineer'], capabilities: ['database'] },
	{ id: 'obsidian', name: 'Obsidian MCP', description: 'Knowledge management', category: 'Productivity', subcategory: 'Notes', official: false, popularity: 75, skills: ['documentation-engineer'], capabilities: ['file_system'] },
	{ id: 'evernote', name: 'Evernote MCP', description: 'Note-taking app', category: 'Productivity', subcategory: 'Notes', official: false, popularity: 60, skills: [], capabilities: ['file_system'] },
	{ id: 'calendly', name: 'Calendly MCP', description: 'Meeting scheduling', category: 'Productivity', subcategory: 'Scheduling', official: false, popularity: 80, skills: [], capabilities: ['calendar'] },
	{ id: 'cal-com', name: 'Cal.com MCP', description: 'Open source scheduling', category: 'Productivity', subcategory: 'Scheduling', official: false, popularity: 70, skills: [], capabilities: ['calendar'] },
	{ id: 'clockify', name: 'Clockify MCP', description: 'Time tracking', category: 'Productivity', subcategory: 'Time', official: false, popularity: 65, skills: [], capabilities: ['analytics'] },

	// ============================================
	// Design (116-125)
	// ============================================
	{ id: 'figma', name: 'Figma MCP', description: 'Design collaboration platform', category: 'Design', subcategory: 'UI/UX', official: false, popularity: 95, skills: ['ui-design', 'figma-to-code'], capabilities: ['custom'] },
	{ id: 'canva', name: 'Canva MCP', description: 'Graphic design platform', category: 'Design', subcategory: 'Graphics', official: false, popularity: 85, skills: ['marketing'], capabilities: ['image_gen'] },
	{ id: 'adobe-cc', name: 'Adobe Creative Cloud MCP', description: 'Photoshop, Illustrator APIs', category: 'Design', subcategory: 'Graphics', official: false, popularity: 75, skills: ['ui-design'], capabilities: ['image_gen'] },
	{ id: 'sketch', name: 'Sketch MCP', description: 'Mac design tool', category: 'Design', subcategory: 'UI/UX', official: false, popularity: 60, skills: ['ui-design'], capabilities: ['custom'] },
	{ id: 'framer', name: 'Framer MCP', description: 'Interactive design', category: 'Design', subcategory: 'UI/UX', official: false, popularity: 70, skills: ['ui-design', 'frontend'], capabilities: ['custom'] },
	{ id: 'zeplin', name: 'Zeplin MCP', description: 'Design handoff', category: 'Design', subcategory: 'Handoff', official: false, popularity: 55, skills: ['ui-design'], capabilities: ['custom'] },
	{ id: 'invision', name: 'InVision MCP', description: 'Prototyping platform', category: 'Design', subcategory: 'Prototyping', official: false, popularity: 50, skills: ['ui-design'], capabilities: ['custom'] },
	{ id: 'miro', name: 'Miro MCP', description: 'Visual collaboration', category: 'Design', subcategory: 'Whiteboard', official: false, popularity: 80, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'whimsical', name: 'Whimsical MCP', description: 'Diagrams and wireframes', category: 'Design', subcategory: 'Diagrams', official: false, popularity: 65, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'excalidraw', name: 'Excalidraw MCP', description: 'Hand-drawn diagrams', category: 'Design', subcategory: 'Diagrams', official: false, popularity: 70, skills: [], capabilities: ['custom'] },

	// ============================================
	// Media & Creative (126-145)
	// ============================================
	{ id: 'dalle', name: 'DALL-E MCP', description: 'OpenAI image generation', category: 'Media', subcategory: 'Image Gen', official: false, popularity: 95, skills: ['ai-image-generation'], capabilities: ['image_gen'] },
	{ id: 'midjourney', name: 'Midjourney MCP', description: 'AI art generation', category: 'Media', subcategory: 'Image Gen', official: false, popularity: 90, skills: ['ai-image-generation'], capabilities: ['image_gen'] },
	{ id: 'stable-diffusion', name: 'Stable Diffusion MCP', description: 'Open source image gen', category: 'Media', subcategory: 'Image Gen', official: false, popularity: 85, skills: ['ai-image-generation'], capabilities: ['image_gen'] },
	{ id: 'leonardo', name: 'Leonardo.ai MCP', description: 'AI art platform', category: 'Media', subcategory: 'Image Gen', official: false, popularity: 75, skills: ['ai-image-generation'], capabilities: ['image_gen'] },
	{ id: 'flux', name: 'Flux MCP', description: 'Black Forest Labs image gen', category: 'Media', subcategory: 'Image Gen', official: false, popularity: 80, skills: ['ai-image-generation'], capabilities: ['image_gen'] },
	{ id: 'elevenlabs', name: 'ElevenLabs MCP', description: 'AI voice synthesis', category: 'Media', subcategory: 'Audio', official: false, popularity: 90, skills: ['text-to-speech'], capabilities: ['audio_gen'] },
	{ id: 'whisper', name: 'Whisper MCP', description: 'Speech-to-text', category: 'Media', subcategory: 'Audio', official: false, popularity: 85, skills: ['speech-recognition'], capabilities: ['audio_gen'] },
	{ id: 'murf', name: 'Murf MCP', description: 'AI voiceover', category: 'Media', subcategory: 'Audio', official: false, popularity: 65, skills: [], capabilities: ['audio_gen'] },
	{ id: 'descript', name: 'Descript MCP', description: 'Audio/video editing', category: 'Media', subcategory: 'Audio', official: false, popularity: 70, skills: [], capabilities: ['audio_gen', 'video_gen'] },
	{ id: 'youtube', name: 'YouTube MCP', description: 'Video platform API', category: 'Media', subcategory: 'Video', official: false, popularity: 90, skills: ['content-strategy'], capabilities: ['video_gen'] },
	{ id: 'vimeo', name: 'Vimeo MCP', description: 'Professional video', category: 'Media', subcategory: 'Video', official: false, popularity: 60, skills: [], capabilities: ['video_gen'] },
	{ id: 'loom', name: 'Loom MCP', description: 'Video messaging', category: 'Media', subcategory: 'Video', official: false, popularity: 75, skills: ['documentation-engineer'], capabilities: ['video_gen'] },
	{ id: 'runway', name: 'Runway MCP', description: 'AI video generation', category: 'Media', subcategory: 'Video Gen', official: false, popularity: 85, skills: ['text-to-video'], capabilities: ['video_gen'] },
	{ id: 'pika', name: 'Pika MCP', description: 'AI video creation', category: 'Media', subcategory: 'Video Gen', official: false, popularity: 75, skills: ['text-to-video'], capabilities: ['video_gen'] },
	{ id: 'heygen', name: 'HeyGen MCP', description: 'AI avatar videos', category: 'Media', subcategory: 'Video Gen', official: false, popularity: 70, skills: [], capabilities: ['video_gen'] },
	{ id: 'spotify', name: 'Spotify MCP', description: 'Music streaming API', category: 'Media', subcategory: 'Music', official: false, popularity: 75, skills: [], capabilities: ['custom'] },
	{ id: 'soundcloud', name: 'SoundCloud MCP', description: 'Audio platform', category: 'Media', subcategory: 'Music', official: false, popularity: 55, skills: [], capabilities: ['custom'] },
	{ id: 'cloudinary', name: 'Cloudinary MCP', description: 'Media management', category: 'Media', subcategory: 'Storage', official: false, popularity: 80, skills: [], capabilities: ['storage', 'image_gen'] },
	{ id: 'imgix', name: 'Imgix MCP', description: 'Image processing', category: 'Media', subcategory: 'Processing', official: false, popularity: 65, skills: [], capabilities: ['image_gen'] },
	{ id: 'unsplash', name: 'Unsplash MCP', description: 'Stock photos API', category: 'Media', subcategory: 'Stock', official: false, popularity: 70, skills: ['marketing'], capabilities: ['image_gen'] },

	// ============================================
	// CRM & Sales (146-155)
	// ============================================
	{ id: 'salesforce', name: 'Salesforce MCP', description: 'Enterprise CRM', category: 'CRM', subcategory: 'Enterprise', official: false, popularity: 90, skills: ['sales-automation'], capabilities: ['crm'] },
	{ id: 'hubspot', name: 'HubSpot MCP', description: 'Marketing & sales CRM', category: 'CRM', subcategory: 'Marketing', official: false, popularity: 90, skills: ['marketing', 'sales-automation'], capabilities: ['crm', 'email'] },
	{ id: 'pipedrive', name: 'Pipedrive MCP', description: 'Sales pipeline CRM', category: 'CRM', subcategory: 'Sales', official: false, popularity: 75, skills: ['sales-automation'], capabilities: ['crm'] },
	{ id: 'intercom', name: 'Intercom MCP', description: 'Customer messaging', category: 'CRM', subcategory: 'Support', official: false, popularity: 85, skills: ['customer-success'], capabilities: ['notification', 'crm'] },
	{ id: 'zendesk', name: 'Zendesk MCP', description: 'Customer support', category: 'CRM', subcategory: 'Support', official: false, popularity: 80, skills: ['customer-success'], capabilities: ['crm'] },
	{ id: 'freshdesk', name: 'Freshdesk MCP', description: 'Help desk software', category: 'CRM', subcategory: 'Support', official: false, popularity: 65, skills: [], capabilities: ['crm'] },
	{ id: 'mailchimp', name: 'Mailchimp MCP', description: 'Email marketing', category: 'CRM', subcategory: 'Marketing', official: false, popularity: 85, skills: ['email-marketing'], capabilities: ['email'] },
	{ id: 'klaviyo', name: 'Klaviyo MCP', description: 'E-commerce marketing', category: 'CRM', subcategory: 'Marketing', official: false, popularity: 75, skills: ['email-marketing'], capabilities: ['email'] },
	{ id: 'close', name: 'Close MCP', description: 'Sales CRM', category: 'CRM', subcategory: 'Sales', official: false, popularity: 60, skills: [], capabilities: ['crm'] },
	{ id: 'apollo', name: 'Apollo.io MCP', description: 'Sales intelligence', category: 'CRM', subcategory: 'Sales', official: false, popularity: 70, skills: ['sales-automation'], capabilities: ['crm'] },

	// ============================================
	// Analytics (156-170)
	// ============================================
	{ id: 'google-analytics', name: 'Google Analytics MCP', description: 'Web analytics', category: 'Analytics', subcategory: 'Web', official: false, popularity: 95, skills: ['marketing', 'seo'], capabilities: ['analytics'] },
	{ id: 'mixpanel', name: 'Mixpanel MCP', description: 'Product analytics', category: 'Analytics', subcategory: 'Product', official: false, popularity: 85, skills: ['product-management'], capabilities: ['analytics'] },
	{ id: 'amplitude', name: 'Amplitude MCP', description: 'Digital analytics', category: 'Analytics', subcategory: 'Product', official: false, popularity: 85, skills: ['product-management'], capabilities: ['analytics'] },
	{ id: 'posthog', name: 'PostHog MCP', description: 'Open source analytics', category: 'Analytics', subcategory: 'Product', official: false, popularity: 80, skills: ['product-management'], capabilities: ['analytics'] },
	{ id: 'segment', name: 'Segment MCP', description: 'Customer data platform', category: 'Analytics', subcategory: 'CDP', official: false, popularity: 85, skills: ['data-engineer'], capabilities: ['analytics'] },
	{ id: 'heap', name: 'Heap MCP', description: 'Auto-capture analytics', category: 'Analytics', subcategory: 'Product', official: false, popularity: 70, skills: [], capabilities: ['analytics'] },
	{ id: 'hotjar', name: 'Hotjar MCP', description: 'Heatmaps & recordings', category: 'Analytics', subcategory: 'UX', official: false, popularity: 75, skills: ['ui-design'], capabilities: ['analytics'] },
	{ id: 'fullstory', name: 'FullStory MCP', description: 'Session replay', category: 'Analytics', subcategory: 'UX', official: false, popularity: 70, skills: [], capabilities: ['analytics'] },
	{ id: 'looker', name: 'Looker MCP', description: 'BI platform', category: 'Analytics', subcategory: 'BI', official: false, popularity: 75, skills: ['data-engineer'], capabilities: ['analytics'] },
	{ id: 'tableau', name: 'Tableau MCP', description: 'Data visualization', category: 'Analytics', subcategory: 'BI', official: false, popularity: 80, skills: ['data-engineer'], capabilities: ['analytics'] },
	{ id: 'metabase', name: 'Metabase MCP', description: 'Open source BI', category: 'Analytics', subcategory: 'BI', official: false, popularity: 75, skills: ['data-engineer'], capabilities: ['analytics'] },
	{ id: 'plausible', name: 'Plausible MCP', description: 'Privacy-first analytics', category: 'Analytics', subcategory: 'Web', official: false, popularity: 70, skills: [], capabilities: ['analytics'] },
	{ id: 'fathom', name: 'Fathom MCP', description: 'Simple analytics', category: 'Analytics', subcategory: 'Web', official: false, popularity: 60, skills: [], capabilities: ['analytics'] },
	{ id: 'clearbit', name: 'Clearbit MCP', description: 'Business intelligence', category: 'Analytics', subcategory: 'Enrichment', official: false, popularity: 70, skills: ['sales-automation'], capabilities: ['analytics'] },
	{ id: 'snowplow', name: 'Snowplow MCP', description: 'Behavioral data', category: 'Analytics', subcategory: 'CDP', official: false, popularity: 65, skills: ['data-engineer'], capabilities: ['analytics'] },

	// ============================================
	// E-commerce (171-180)
	// ============================================
	{ id: 'shopify', name: 'Shopify MCP', description: 'E-commerce platform', category: 'E-commerce', subcategory: 'Platform', official: false, popularity: 95, skills: ['shopify-developer'], capabilities: ['payment', 'custom'] },
	{ id: 'woocommerce', name: 'WooCommerce MCP', description: 'WordPress e-commerce', category: 'E-commerce', subcategory: 'Platform', official: false, popularity: 80, skills: ['wordpress-developer'], capabilities: ['payment', 'custom'] },
	{ id: 'magento', name: 'Magento MCP', description: 'Enterprise e-commerce', category: 'E-commerce', subcategory: 'Platform', official: false, popularity: 65, skills: [], capabilities: ['payment', 'custom'] },
	{ id: 'bigcommerce', name: 'BigCommerce MCP', description: 'SaaS e-commerce', category: 'E-commerce', subcategory: 'Platform', official: false, popularity: 60, skills: [], capabilities: ['payment', 'custom'] },
	{ id: 'square', name: 'Square MCP', description: 'Payments & POS', category: 'E-commerce', subcategory: 'Payments', official: false, popularity: 80, skills: ['fintech-integration'], capabilities: ['payment'] },
	{ id: 'paypal', name: 'PayPal MCP', description: 'Online payments', category: 'E-commerce', subcategory: 'Payments', official: false, popularity: 85, skills: ['fintech-integration'], capabilities: ['payment'] },
	{ id: 'afterpay', name: 'Afterpay MCP', description: 'Buy now pay later', category: 'E-commerce', subcategory: 'Payments', official: false, popularity: 65, skills: [], capabilities: ['payment'] },
	{ id: 'shippo', name: 'Shippo MCP', description: 'Shipping API', category: 'E-commerce', subcategory: 'Shipping', official: false, popularity: 70, skills: [], capabilities: ['custom'] },
	{ id: 'shipstation', name: 'ShipStation MCP', description: 'Order fulfillment', category: 'E-commerce', subcategory: 'Shipping', official: false, popularity: 65, skills: [], capabilities: ['custom'] },
	{ id: 'printful', name: 'Printful MCP', description: 'Print on demand', category: 'E-commerce', subcategory: 'Fulfillment', official: false, popularity: 60, skills: [], capabilities: ['custom'] },

	// ============================================
	// CMS (181-190)
	// ============================================
	{ id: 'wordpress', name: 'WordPress MCP', description: 'CMS platform', category: 'CMS', subcategory: 'Traditional', official: false, popularity: 90, skills: ['wordpress-developer'], capabilities: ['file_system', 'database'] },
	{ id: 'contentful', name: 'Contentful MCP', description: 'Headless CMS', category: 'CMS', subcategory: 'Headless', official: false, popularity: 85, skills: ['content-strategy'], capabilities: ['file_system'] },
	{ id: 'strapi', name: 'Strapi MCP', description: 'Open source headless CMS', category: 'CMS', subcategory: 'Headless', official: false, popularity: 80, skills: ['content-strategy'], capabilities: ['file_system', 'database'] },
	{ id: 'sanity', name: 'Sanity MCP', description: 'Structured content', category: 'CMS', subcategory: 'Headless', official: false, popularity: 80, skills: ['content-strategy'], capabilities: ['file_system'] },
	{ id: 'prismic', name: 'Prismic MCP', description: 'Headless website builder', category: 'CMS', subcategory: 'Headless', official: false, popularity: 70, skills: [], capabilities: ['file_system'] },
	{ id: 'ghost', name: 'Ghost MCP', description: 'Publishing platform', category: 'CMS', subcategory: 'Publishing', official: false, popularity: 70, skills: ['content-strategy'], capabilities: ['file_system'] },
	{ id: 'webflow', name: 'Webflow MCP', description: 'Visual web builder', category: 'CMS', subcategory: 'Builder', official: false, popularity: 85, skills: ['no-code-builder'], capabilities: ['custom'] },
	{ id: 'builder-io', name: 'Builder.io MCP', description: 'Visual headless CMS', category: 'CMS', subcategory: 'Headless', official: false, popularity: 70, skills: [], capabilities: ['file_system'] },
	{ id: 'storyblok', name: 'Storyblok MCP', description: 'Visual headless CMS', category: 'CMS', subcategory: 'Headless', official: false, popularity: 65, skills: [], capabilities: ['file_system'] },
	{ id: 'directus', name: 'Directus MCP', description: 'Open data platform', category: 'CMS', subcategory: 'Headless', official: false, popularity: 65, skills: [], capabilities: ['file_system', 'database'] },

	// ============================================
	// Social Media (191-200)
	// ============================================
	{ id: 'twitter', name: 'Twitter/X MCP', description: 'Social media platform', category: 'Social', subcategory: 'Microblogging', official: false, popularity: 90, skills: ['marketing', 'social-media'], capabilities: ['social_engagement'] },
	{ id: 'linkedin', name: 'LinkedIn MCP', description: 'Professional network', category: 'Social', subcategory: 'Professional', official: false, popularity: 85, skills: ['marketing', 'recruiting'], capabilities: ['social_engagement'] },
	{ id: 'instagram', name: 'Instagram MCP', description: 'Photo sharing platform', category: 'Social', subcategory: 'Visual', official: false, popularity: 85, skills: ['marketing', 'social-media'], capabilities: ['social_engagement'] },
	{ id: 'facebook', name: 'Facebook MCP', description: 'Social network', category: 'Social', subcategory: 'General', official: false, popularity: 80, skills: ['marketing'], capabilities: ['social_engagement'] },
	{ id: 'tiktok', name: 'TikTok MCP', description: 'Short video platform', category: 'Social', subcategory: 'Video', official: false, popularity: 85, skills: ['marketing', 'content-strategy'], capabilities: ['social_engagement'] },
	{ id: 'reddit', name: 'Reddit MCP', description: 'Community platform', category: 'Social', subcategory: 'Forums', official: false, popularity: 75, skills: ['community-building'], capabilities: ['social_engagement'] },
	{ id: 'pinterest', name: 'Pinterest MCP', description: 'Visual discovery', category: 'Social', subcategory: 'Visual', official: false, popularity: 70, skills: ['marketing'], capabilities: ['social_engagement'] },
	{ id: 'buffer', name: 'Buffer MCP', description: 'Social media scheduling', category: 'Social', subcategory: 'Management', official: false, popularity: 75, skills: ['social-media'], capabilities: ['social_engagement'] },
	{ id: 'hootsuite', name: 'Hootsuite MCP', description: 'Social media management', category: 'Social', subcategory: 'Management', official: false, popularity: 70, skills: ['social-media'], capabilities: ['social_engagement'] },
	{ id: 'later', name: 'Later MCP', description: 'Visual social scheduler', category: 'Social', subcategory: 'Management', official: false, popularity: 65, skills: [], capabilities: ['social_engagement'] },

	// ============================================
	// Maps & Location (201-205)
	// ============================================
	{ id: 'google-maps', name: 'Google Maps MCP', description: 'Maps and geolocation', category: 'Location', subcategory: 'Maps', official: false, popularity: 95, skills: [], capabilities: ['custom'] },
	{ id: 'mapbox', name: 'Mapbox MCP', description: 'Custom maps', category: 'Location', subcategory: 'Maps', official: false, popularity: 80, skills: [], capabilities: ['custom'] },
	{ id: 'openstreetmap', name: 'OpenStreetMap MCP', description: 'Open source maps', category: 'Location', subcategory: 'Maps', official: false, popularity: 70, skills: [], capabilities: ['custom'] },
	{ id: 'here', name: 'HERE MCP', description: 'Location services', category: 'Location', subcategory: 'Maps', official: false, popularity: 60, skills: [], capabilities: ['custom'] },
	{ id: 'what3words', name: 'What3Words MCP', description: 'Location addressing', category: 'Location', subcategory: 'Addressing', official: false, popularity: 55, skills: [], capabilities: ['custom'] },

	// ============================================
	// Utilities (206-215)
	// ============================================
	{ id: 'openweather', name: 'OpenWeather MCP', description: 'Weather data API', category: 'Utilities', subcategory: 'Weather', official: false, popularity: 80, skills: [], capabilities: ['custom'] },
	{ id: 'weatherapi', name: 'WeatherAPI MCP', description: 'Weather forecasts', category: 'Utilities', subcategory: 'Weather', official: false, popularity: 70, skills: [], capabilities: ['custom'] },
	{ id: 'deepl', name: 'DeepL MCP', description: 'AI translation', category: 'Utilities', subcategory: 'Translation', official: false, popularity: 85, skills: ['i18n'], capabilities: ['custom'] },
	{ id: 'google-translate', name: 'Google Translate MCP', description: 'Translation service', category: 'Utilities', subcategory: 'Translation', official: false, popularity: 90, skills: ['i18n'], capabilities: ['custom'] },
	{ id: 'currencyapi', name: 'Currency API MCP', description: 'Exchange rates', category: 'Utilities', subcategory: 'Finance', official: false, popularity: 65, skills: [], capabilities: ['custom'] },
	{ id: 'ip-geolocation', name: 'IP Geolocation MCP', description: 'IP to location', category: 'Utilities', subcategory: 'Geolocation', official: false, popularity: 60, skills: [], capabilities: ['custom'] },
	{ id: 'qrcode', name: 'QR Code MCP', description: 'QR code generation', category: 'Utilities', subcategory: 'Generation', official: false, popularity: 65, skills: [], capabilities: ['image_gen'] },
	{ id: 'pdf', name: 'PDF MCP', description: 'PDF generation & parsing', category: 'Utilities', subcategory: 'Documents', official: false, popularity: 80, skills: ['documentation-engineer'], capabilities: ['file_system'] },
	{ id: 'ocr', name: 'OCR MCP', description: 'Text extraction from images', category: 'Utilities', subcategory: 'Vision', official: false, popularity: 75, skills: [], capabilities: ['custom'] },
	{ id: 'timezone', name: 'Timezone MCP', description: 'Timezone conversions', category: 'Utilities', subcategory: 'Time', official: false, popularity: 55, skills: [], capabilities: ['custom'] },

	// ============================================
	// IoT & Smart Home (216-220)
	// ============================================
	{ id: 'home-assistant', name: 'Home Assistant MCP', description: 'Smart home control', category: 'IoT', subcategory: 'Smart Home', official: false, popularity: 85, skills: [], capabilities: ['custom'] },
	{ id: 'philips-hue', name: 'Philips Hue MCP', description: 'Smart lighting', category: 'IoT', subcategory: 'Lighting', official: false, popularity: 70, skills: [], capabilities: ['custom'] },
	{ id: 'nest', name: 'Nest MCP', description: 'Google Nest devices', category: 'IoT', subcategory: 'Smart Home', official: false, popularity: 65, skills: [], capabilities: ['custom'] },
	{ id: 'mqtt', name: 'MQTT MCP', description: 'IoT messaging protocol', category: 'IoT', subcategory: 'Protocol', official: false, popularity: 70, skills: ['iot-developer'], capabilities: ['notification'] },
	{ id: 'particle', name: 'Particle MCP', description: 'IoT device platform', category: 'IoT', subcategory: 'Platform', official: false, popularity: 55, skills: ['iot-developer'], capabilities: ['custom'] },

	// ============================================
	// Marketing (221-245)
	// ============================================
	{ id: 'google-ads', name: 'Google Ads MCP', description: 'Search & display advertising', category: 'Marketing', subcategory: 'Advertising', official: false, popularity: 95, skills: ['marketing', 'paid-acquisition'], capabilities: ['analytics'] },
	{ id: 'meta-ads', name: 'Meta Ads MCP', description: 'Facebook & Instagram ads', category: 'Marketing', subcategory: 'Advertising', official: false, popularity: 90, skills: ['marketing', 'paid-acquisition'], capabilities: ['analytics'] },
	{ id: 'tiktok-ads', name: 'TikTok Ads MCP', description: 'TikTok advertising platform', category: 'Marketing', subcategory: 'Advertising', official: false, popularity: 80, skills: ['marketing'], capabilities: ['analytics'] },
	{ id: 'linkedin-ads', name: 'LinkedIn Ads MCP', description: 'B2B advertising', category: 'Marketing', subcategory: 'Advertising', official: false, popularity: 75, skills: ['marketing', 'b2b-marketing'], capabilities: ['analytics'] },
	{ id: 'semrush', name: 'Semrush MCP', description: 'SEO & competitive research', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 90, skills: ['seo', 'content-strategy'], capabilities: ['analytics', 'seo'] },
	{ id: 'ahrefs', name: 'Ahrefs MCP', description: 'Backlink & SEO analysis', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 90, skills: ['seo', 'content-strategy'], capabilities: ['analytics', 'seo'] },
	{ id: 'moz', name: 'Moz MCP', description: 'SEO software suite', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 75, skills: ['seo'], capabilities: ['analytics', 'seo'] },
	{ id: 'screaming-frog', name: 'Screaming Frog MCP', description: 'SEO spider & crawler', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 70, skills: ['seo'], capabilities: ['web_fetch', 'seo'] },
	{ id: 'search-console', name: 'Google Search Console MCP', description: 'Search performance data', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 90, skills: ['seo'], capabilities: ['analytics', 'seo'] },
	{ id: 'convertkit', name: 'ConvertKit MCP', description: 'Creator email marketing', category: 'Marketing', subcategory: 'Email', official: false, popularity: 80, skills: ['email-marketing'], capabilities: ['email'] },
	{ id: 'activecampaign', name: 'ActiveCampaign MCP', description: 'Marketing automation', category: 'Marketing', subcategory: 'Automation', official: false, popularity: 80, skills: ['marketing', 'email-marketing'], capabilities: ['email', 'crm'] },
	{ id: 'marketo', name: 'Marketo MCP', description: 'Enterprise marketing automation', category: 'Marketing', subcategory: 'Automation', official: false, popularity: 75, skills: ['marketing', 'b2b-marketing'], capabilities: ['email', 'crm'] },
	{ id: 'pardot', name: 'Pardot MCP', description: 'Salesforce B2B marketing', category: 'Marketing', subcategory: 'Automation', official: false, popularity: 70, skills: ['b2b-marketing'], capabilities: ['email', 'crm'] },
	{ id: 'drip', name: 'Drip MCP', description: 'E-commerce email automation', category: 'Marketing', subcategory: 'Email', official: false, popularity: 65, skills: ['email-marketing'], capabilities: ['email'] },
	{ id: 'jasper', name: 'Jasper AI MCP', description: 'AI copywriting assistant', category: 'Marketing', subcategory: 'Content', official: false, popularity: 85, skills: ['copywriting', 'content-strategy'], capabilities: ['custom'] },
	{ id: 'copy-ai', name: 'Copy.ai MCP', description: 'AI content generation', category: 'Marketing', subcategory: 'Content', official: false, popularity: 80, skills: ['copywriting'], capabilities: ['custom'] },
	{ id: 'surfer-seo', name: 'Surfer SEO MCP', description: 'Content optimization', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 75, skills: ['seo', 'content-strategy'], capabilities: ['seo'] },
	{ id: 'clearscope', name: 'Clearscope MCP', description: 'Content optimization platform', category: 'Marketing', subcategory: 'SEO', official: false, popularity: 70, skills: ['seo', 'content-strategy'], capabilities: ['seo'] },
	{ id: 'optimizely', name: 'Optimizely MCP', description: 'A/B testing & experimentation', category: 'Marketing', subcategory: 'Testing', official: false, popularity: 80, skills: ['product-management', 'marketing'], capabilities: ['analytics'] },
	{ id: 'vwo', name: 'VWO MCP', description: 'Conversion optimization', category: 'Marketing', subcategory: 'Testing', official: false, popularity: 70, skills: ['marketing'], capabilities: ['analytics'] },
	{ id: 'unbounce', name: 'Unbounce MCP', description: 'Landing page builder', category: 'Marketing', subcategory: 'Landing Pages', official: false, popularity: 75, skills: ['marketing'], capabilities: ['custom'] },
	{ id: 'leadpages', name: 'Leadpages MCP', description: 'Lead generation pages', category: 'Marketing', subcategory: 'Landing Pages', official: false, popularity: 65, skills: ['marketing'], capabilities: ['custom'] },
	{ id: 'typeform', name: 'Typeform MCP', description: 'Interactive forms & surveys', category: 'Marketing', subcategory: 'Forms', official: false, popularity: 80, skills: ['marketing', 'product-management'], capabilities: ['custom'] },
	{ id: 'jotform', name: 'JotForm MCP', description: 'Form builder', category: 'Marketing', subcategory: 'Forms', official: false, popularity: 70, skills: [], capabilities: ['custom'] },
	{ id: 'beehiiv', name: 'Beehiiv MCP', description: 'Newsletter platform', category: 'Marketing', subcategory: 'Newsletter', official: false, popularity: 75, skills: ['content-strategy'], capabilities: ['email'] },

	// ============================================
	// No-Code & Automation (246-265)
	// ============================================
	{ id: 'zapier', name: 'Zapier MCP', description: 'No-code workflow automation', category: 'No-Code', subcategory: 'Automation', official: false, popularity: 95, skills: ['no-code-builder', 'automation'], capabilities: ['custom'] },
	{ id: 'make', name: 'Make (Integromat) MCP', description: 'Visual automation platform', category: 'No-Code', subcategory: 'Automation', official: false, popularity: 90, skills: ['no-code-builder', 'automation'], capabilities: ['custom'] },
	{ id: 'n8n', name: 'n8n MCP', description: 'Open source workflow automation', category: 'No-Code', subcategory: 'Automation', official: false, popularity: 85, skills: ['automation'], capabilities: ['custom'] },
	{ id: 'pipedream', name: 'Pipedream MCP', description: 'Developer workflow platform', category: 'No-Code', subcategory: 'Automation', official: false, popularity: 75, skills: ['automation'], capabilities: ['custom'] },
	{ id: 'tray-io', name: 'Tray.io MCP', description: 'Enterprise automation', category: 'No-Code', subcategory: 'Automation', official: false, popularity: 65, skills: ['automation'], capabilities: ['custom'] },
	{ id: 'bubble', name: 'Bubble MCP', description: 'No-code web app builder', category: 'No-Code', subcategory: 'App Builder', official: false, popularity: 90, skills: ['no-code-builder'], capabilities: ['custom'] },
	{ id: 'retool', name: 'Retool MCP', description: 'Internal tool builder', category: 'No-Code', subcategory: 'App Builder', official: false, popularity: 90, skills: ['no-code-builder'], capabilities: ['database', 'custom'] },
	{ id: 'appsmith', name: 'Appsmith MCP', description: 'Open source internal tools', category: 'No-Code', subcategory: 'App Builder', official: false, popularity: 75, skills: ['no-code-builder'], capabilities: ['database', 'custom'] },
	{ id: 'glide', name: 'Glide MCP', description: 'No-code mobile apps', category: 'No-Code', subcategory: 'App Builder', official: false, popularity: 75, skills: ['no-code-builder'], capabilities: ['custom'] },
	{ id: 'softr', name: 'Softr MCP', description: 'Airtable-powered apps', category: 'No-Code', subcategory: 'App Builder', official: false, popularity: 70, skills: ['no-code-builder'], capabilities: ['custom'] },
	{ id: 'adalo', name: 'Adalo MCP', description: 'No-code mobile app builder', category: 'No-Code', subcategory: 'App Builder', official: false, popularity: 65, skills: ['no-code-builder'], capabilities: ['custom'] },
	{ id: 'voiceflow', name: 'Voiceflow MCP', description: 'Conversational AI builder', category: 'No-Code', subcategory: 'AI Builder', official: false, popularity: 70, skills: ['no-code-builder'], capabilities: ['custom'] },
	{ id: 'botpress', name: 'Botpress MCP', description: 'Open source chatbot builder', category: 'No-Code', subcategory: 'AI Builder', official: false, popularity: 70, skills: ['chatbot-builder'], capabilities: ['custom'] },
	{ id: 'landbot', name: 'Landbot MCP', description: 'No-code chatbot builder', category: 'No-Code', subcategory: 'AI Builder', official: false, popularity: 60, skills: ['chatbot-builder'], capabilities: ['custom'] },
	{ id: 'typebot', name: 'Typebot MCP', description: 'Open source conversational forms', category: 'No-Code', subcategory: 'AI Builder', official: false, popularity: 60, skills: [], capabilities: ['custom'] },
	{ id: 'bardeen', name: 'Bardeen MCP', description: 'Browser automation', category: 'No-Code', subcategory: 'Browser', official: false, popularity: 65, skills: ['automation'], capabilities: ['web_fetch'] },
	{ id: 'axiom', name: 'Axiom MCP', description: 'Browser automation bot', category: 'No-Code', subcategory: 'Browser', official: false, popularity: 60, skills: ['automation'], capabilities: ['web_fetch'] },
	{ id: 'parabola', name: 'Parabola MCP', description: 'No-code data workflows', category: 'No-Code', subcategory: 'Data', official: false, popularity: 65, skills: ['data-engineer'], capabilities: ['database'] },
	{ id: 'rows', name: 'Rows MCP', description: 'Spreadsheet with integrations', category: 'No-Code', subcategory: 'Data', official: false, popularity: 55, skills: [], capabilities: ['database'] },
	{ id: 'coda', name: 'Coda MCP', description: 'All-in-one doc with apps', category: 'No-Code', subcategory: 'Docs', official: false, popularity: 75, skills: ['no-code-builder'], capabilities: ['database', 'file_system'] },

	// ============================================
	// Legal (266-280)
	// ============================================
	{ id: 'docusign', name: 'DocuSign MCP', description: 'Electronic signatures', category: 'Legal', subcategory: 'E-Signature', official: false, popularity: 95, skills: [], capabilities: ['file_system'] },
	{ id: 'pandadoc', name: 'PandaDoc MCP', description: 'Document automation & e-sign', category: 'Legal', subcategory: 'E-Signature', official: false, popularity: 85, skills: [], capabilities: ['file_system'] },
	{ id: 'hellosign', name: 'HelloSign MCP', description: 'Dropbox e-signature', category: 'Legal', subcategory: 'E-Signature', official: false, popularity: 75, skills: [], capabilities: ['file_system'] },
	{ id: 'signwell', name: 'SignWell MCP', description: 'Simple e-signatures', category: 'Legal', subcategory: 'E-Signature', official: false, popularity: 60, skills: [], capabilities: ['file_system'] },
	{ id: 'contractpodai', name: 'ContractPod AI MCP', description: 'AI contract management', category: 'Legal', subcategory: 'CLM', official: false, popularity: 65, skills: [], capabilities: ['file_system'] },
	{ id: 'ironclad', name: 'Ironclad MCP', description: 'Contract lifecycle management', category: 'Legal', subcategory: 'CLM', official: false, popularity: 70, skills: [], capabilities: ['file_system'] },
	{ id: 'juro', name: 'Juro MCP', description: 'Contract automation', category: 'Legal', subcategory: 'CLM', official: false, popularity: 65, skills: [], capabilities: ['file_system'] },
	{ id: 'clio', name: 'Clio MCP', description: 'Legal practice management', category: 'Legal', subcategory: 'Practice', official: false, popularity: 75, skills: [], capabilities: ['custom'] },
	{ id: 'legalzoom', name: 'LegalZoom MCP', description: 'Legal document services', category: 'Legal', subcategory: 'Documents', official: false, popularity: 70, skills: [], capabilities: ['file_system'] },
	{ id: 'rocket-lawyer', name: 'Rocket Lawyer MCP', description: 'Legal services platform', category: 'Legal', subcategory: 'Documents', official: false, popularity: 60, skills: [], capabilities: ['file_system'] },
	{ id: 'clerky', name: 'Clerky MCP', description: 'Startup legal paperwork', category: 'Legal', subcategory: 'Startup', official: false, popularity: 70, skills: ['startup-legal'], capabilities: ['file_system'] },
	{ id: 'carta', name: 'Carta MCP', description: 'Equity management', category: 'Legal', subcategory: 'Equity', official: false, popularity: 85, skills: ['startup-finance'], capabilities: ['custom'] },
	{ id: 'pulley', name: 'Pulley MCP', description: 'Cap table management', category: 'Legal', subcategory: 'Equity', official: false, popularity: 70, skills: ['startup-finance'], capabilities: ['custom'] },
	{ id: 'angelist-stack', name: 'AngelList Stack MCP', description: 'Startup fundraising tools', category: 'Legal', subcategory: 'Startup', official: false, popularity: 75, skills: ['startup-finance'], capabilities: ['custom'] },
	{ id: 'termly', name: 'Termly MCP', description: 'Privacy policy generator', category: 'Legal', subcategory: 'Compliance', official: false, popularity: 60, skills: [], capabilities: ['file_system'] },

	// ============================================
	// HR & Recruiting (281-300)
	// ============================================
	{ id: 'bamboohr', name: 'BambooHR MCP', description: 'HR software for SMBs', category: 'HR', subcategory: 'HRIS', official: false, popularity: 85, skills: [], capabilities: ['custom'] },
	{ id: 'gusto', name: 'Gusto MCP', description: 'Payroll & benefits', category: 'HR', subcategory: 'Payroll', official: false, popularity: 90, skills: [], capabilities: ['payment'] },
	{ id: 'rippling', name: 'Rippling MCP', description: 'HR, IT & finance platform', category: 'HR', subcategory: 'HRIS', official: false, popularity: 85, skills: [], capabilities: ['custom'] },
	{ id: 'workday', name: 'Workday MCP', description: 'Enterprise HR & finance', category: 'HR', subcategory: 'Enterprise', official: false, popularity: 80, skills: [], capabilities: ['custom'] },
	{ id: 'adp', name: 'ADP MCP', description: 'Payroll & HR services', category: 'HR', subcategory: 'Payroll', official: false, popularity: 80, skills: [], capabilities: ['payment'] },
	{ id: 'paylocity', name: 'Paylocity MCP', description: 'Cloud payroll & HCM', category: 'HR', subcategory: 'Payroll', official: false, popularity: 70, skills: [], capabilities: ['payment'] },
	{ id: 'paychex', name: 'Paychex MCP', description: 'Payroll services', category: 'HR', subcategory: 'Payroll', official: false, popularity: 70, skills: [], capabilities: ['payment'] },
	{ id: 'deel', name: 'Deel MCP', description: 'Global payroll & compliance', category: 'HR', subcategory: 'Global', official: false, popularity: 85, skills: [], capabilities: ['payment'] },
	{ id: 'remote', name: 'Remote.com MCP', description: 'Global HR platform', category: 'HR', subcategory: 'Global', official: false, popularity: 80, skills: [], capabilities: ['payment'] },
	{ id: 'oyster', name: 'Oyster MCP', description: 'Global employment platform', category: 'HR', subcategory: 'Global', official: false, popularity: 75, skills: [], capabilities: ['payment'] },
	{ id: 'greenhouse', name: 'Greenhouse MCP', description: 'Recruiting software', category: 'HR', subcategory: 'Recruiting', official: false, popularity: 90, skills: ['recruiting'], capabilities: ['custom'] },
	{ id: 'lever', name: 'Lever MCP', description: 'Talent acquisition', category: 'HR', subcategory: 'Recruiting', official: false, popularity: 80, skills: ['recruiting'], capabilities: ['custom'] },
	{ id: 'ashby', name: 'Ashby MCP', description: 'All-in-one recruiting', category: 'HR', subcategory: 'Recruiting', official: false, popularity: 75, skills: ['recruiting'], capabilities: ['custom'] },
	{ id: 'workable', name: 'Workable MCP', description: 'Recruiting & HR', category: 'HR', subcategory: 'Recruiting', official: false, popularity: 75, skills: ['recruiting'], capabilities: ['custom'] },
	{ id: 'breezy', name: 'Breezy HR MCP', description: 'Recruiting software', category: 'HR', subcategory: 'Recruiting', official: false, popularity: 65, skills: [], capabilities: ['custom'] },
	{ id: 'linkedin-recruiter', name: 'LinkedIn Recruiter MCP', description: 'Professional recruiting', category: 'HR', subcategory: 'Recruiting', official: false, popularity: 90, skills: ['recruiting'], capabilities: ['custom'] },
	{ id: 'lattice', name: 'Lattice MCP', description: 'People management platform', category: 'HR', subcategory: 'Performance', official: false, popularity: 80, skills: [], capabilities: ['custom'] },
	{ id: '15five', name: '15Five MCP', description: 'Performance management', category: 'HR', subcategory: 'Performance', official: false, popularity: 70, skills: [], capabilities: ['custom'] },
	{ id: 'culture-amp', name: 'Culture Amp MCP', description: 'Employee experience', category: 'HR', subcategory: 'Engagement', official: false, popularity: 75, skills: [], capabilities: ['analytics'] },
	{ id: 'officevibe', name: 'Officevibe MCP', description: 'Employee engagement', category: 'HR', subcategory: 'Engagement', official: false, popularity: 65, skills: [], capabilities: ['analytics'] },

	// ============================================
	// Product Management (301-320)
	// ============================================
	{ id: 'productboard', name: 'ProductBoard MCP', description: 'Product management platform', category: 'Product', subcategory: 'Roadmap', official: false, popularity: 85, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'aha', name: 'Aha! MCP', description: 'Product roadmap software', category: 'Product', subcategory: 'Roadmap', official: false, popularity: 80, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'roadmunk', name: 'Roadmunk MCP', description: 'Visual roadmapping', category: 'Product', subcategory: 'Roadmap', official: false, popularity: 65, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'airfocus', name: 'Airfocus MCP', description: 'Product management & roadmaps', category: 'Product', subcategory: 'Roadmap', official: false, popularity: 65, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'canny', name: 'Canny MCP', description: 'User feedback management', category: 'Product', subcategory: 'Feedback', official: false, popularity: 80, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'uservoice', name: 'UserVoice MCP', description: 'Product feedback tool', category: 'Product', subcategory: 'Feedback', official: false, popularity: 65, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'pendo', name: 'Pendo MCP', description: 'Product analytics & guidance', category: 'Product', subcategory: 'Analytics', official: false, popularity: 85, skills: ['product-management'], capabilities: ['analytics'] },
	{ id: 'appcues', name: 'Appcues MCP', description: 'Product-led growth platform', category: 'Product', subcategory: 'Onboarding', official: false, popularity: 75, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'userpilot', name: 'Userpilot MCP', description: 'Product adoption platform', category: 'Product', subcategory: 'Onboarding', official: false, popularity: 70, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'chameleon', name: 'Chameleon MCP', description: 'In-product experiences', category: 'Product', subcategory: 'Onboarding', official: false, popularity: 65, skills: [], capabilities: ['custom'] },
	{ id: 'maze', name: 'Maze MCP', description: 'User testing platform', category: 'Product', subcategory: 'Research', official: false, popularity: 80, skills: ['user-research'], capabilities: ['analytics'] },
	{ id: 'usertesting', name: 'UserTesting MCP', description: 'User experience research', category: 'Product', subcategory: 'Research', official: false, popularity: 80, skills: ['user-research'], capabilities: ['analytics'] },
	{ id: 'lookback', name: 'Lookback MCP', description: 'User research platform', category: 'Product', subcategory: 'Research', official: false, popularity: 65, skills: ['user-research'], capabilities: ['analytics'] },
	{ id: 'dovetail', name: 'Dovetail MCP', description: 'User research repository', category: 'Product', subcategory: 'Research', official: false, popularity: 75, skills: ['user-research'], capabilities: ['file_system'] },
	{ id: 'loom-sdk', name: 'Loom SDK MCP', description: 'Async video for products', category: 'Product', subcategory: 'Communication', official: false, popularity: 70, skills: [], capabilities: ['video_gen'] },
	{ id: 'intercom-product', name: 'Intercom Product Tours MCP', description: 'In-app product tours', category: 'Product', subcategory: 'Onboarding', official: false, popularity: 75, skills: [], capabilities: ['custom'] },
	{ id: 'productplan', name: 'ProductPlan MCP', description: 'Roadmap software', category: 'Product', subcategory: 'Roadmap', official: false, popularity: 65, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'pivotal-tracker', name: 'Pivotal Tracker MCP', description: 'Agile project management', category: 'Product', subcategory: 'Agile', official: false, popularity: 60, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'shortcut', name: 'Shortcut MCP', description: 'Project management for devs', category: 'Product', subcategory: 'Agile', official: false, popularity: 70, skills: ['product-management'], capabilities: ['custom'] },
	{ id: 'clickup', name: 'ClickUp MCP', description: 'All-in-one productivity', category: 'Product', subcategory: 'Project', official: false, popularity: 85, skills: ['product-management'], capabilities: ['custom'] },

	// ============================================
	// Blockchain & Web3 (321-345)
	// ============================================
	{ id: 'alchemy', name: 'Alchemy MCP', description: 'Web3 development platform', category: 'Blockchain', subcategory: 'Infrastructure', official: false, popularity: 95, skills: ['web3-developer', 'smart-contracts'], capabilities: ['custom'] },
	{ id: 'infura', name: 'Infura MCP', description: 'Ethereum API & IPFS', category: 'Blockchain', subcategory: 'Infrastructure', official: false, popularity: 90, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'moralis', name: 'Moralis MCP', description: 'Web3 data & auth', category: 'Blockchain', subcategory: 'Infrastructure', official: false, popularity: 85, skills: ['web3-developer'], capabilities: ['database'] },
	{ id: 'quicknode', name: 'QuickNode MCP', description: 'Blockchain infrastructure', category: 'Blockchain', subcategory: 'Infrastructure', official: false, popularity: 80, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'thegraph', name: 'The Graph MCP', description: 'Blockchain data indexing', category: 'Blockchain', subcategory: 'Data', official: false, popularity: 85, skills: ['web3-developer', 'defi-architect'], capabilities: ['database'] },
	{ id: 'dune', name: 'Dune Analytics MCP', description: 'Blockchain analytics', category: 'Blockchain', subcategory: 'Data', official: false, popularity: 85, skills: ['defi-architect', 'blockchain-analyst'], capabilities: ['analytics'] },
	{ id: 'nansen', name: 'Nansen MCP', description: 'On-chain analytics', category: 'Blockchain', subcategory: 'Data', official: false, popularity: 75, skills: ['blockchain-analyst'], capabilities: ['analytics'] },
	{ id: 'etherscan', name: 'Etherscan MCP', description: 'Ethereum block explorer', category: 'Blockchain', subcategory: 'Explorer', official: false, popularity: 90, skills: ['web3-developer'], capabilities: ['analytics'] },
	{ id: 'polygonscan', name: 'Polygonscan MCP', description: 'Polygon block explorer', category: 'Blockchain', subcategory: 'Explorer', official: false, popularity: 75, skills: ['web3-developer'], capabilities: ['analytics'] },
	{ id: 'solscan', name: 'Solscan MCP', description: 'Solana block explorer', category: 'Blockchain', subcategory: 'Explorer', official: false, popularity: 70, skills: ['solana-developer'], capabilities: ['analytics'] },
	{ id: 'chainlink', name: 'Chainlink MCP', description: 'Decentralized oracles', category: 'Blockchain', subcategory: 'Oracles', official: false, popularity: 90, skills: ['smart-contracts', 'defi-architect'], capabilities: ['custom'] },
	{ id: 'pyth', name: 'Pyth MCP', description: 'High-fidelity price feeds', category: 'Blockchain', subcategory: 'Oracles', official: false, popularity: 75, skills: ['defi-architect'], capabilities: ['custom'] },
	{ id: 'openzeppelin', name: 'OpenZeppelin MCP', description: 'Smart contract security', category: 'Blockchain', subcategory: 'Security', official: false, popularity: 90, skills: ['smart-contracts', 'security'], capabilities: ['security_scan'] },
	{ id: 'slither', name: 'Slither MCP', description: 'Solidity static analysis', category: 'Blockchain', subcategory: 'Security', official: false, popularity: 80, skills: ['smart-contracts', 'security'], capabilities: ['security_scan', 'code_analysis'] },
	{ id: 'foundry', name: 'Foundry MCP', description: 'Smart contract development', category: 'Blockchain', subcategory: 'Development', official: false, popularity: 85, skills: ['smart-contracts'], capabilities: ['code_exec'] },
	{ id: 'hardhat', name: 'Hardhat MCP', description: 'Ethereum development environment', category: 'Blockchain', subcategory: 'Development', official: false, popularity: 90, skills: ['smart-contracts', 'web3-developer'], capabilities: ['code_exec'] },
	{ id: 'wagmi', name: 'Wagmi MCP', description: 'React hooks for Ethereum', category: 'Blockchain', subcategory: 'Frontend', official: false, popularity: 85, skills: ['web3-developer', 'frontend'], capabilities: ['custom'] },
	{ id: 'ethers', name: 'Ethers.js MCP', description: 'Ethereum library', category: 'Blockchain', subcategory: 'Library', official: false, popularity: 90, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'web3js', name: 'Web3.js MCP', description: 'Ethereum JavaScript API', category: 'Blockchain', subcategory: 'Library', official: false, popularity: 85, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'viem', name: 'Viem MCP', description: 'TypeScript Ethereum interface', category: 'Blockchain', subcategory: 'Library', official: false, popularity: 80, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'rainbowkit', name: 'RainbowKit MCP', description: 'Wallet connection kit', category: 'Blockchain', subcategory: 'Wallet', official: false, popularity: 80, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'walletconnect', name: 'WalletConnect MCP', description: 'Multi-chain wallet protocol', category: 'Blockchain', subcategory: 'Wallet', official: false, popularity: 85, skills: ['web3-developer'], capabilities: ['custom'] },
	{ id: 'safe', name: 'Safe (Gnosis) MCP', description: 'Multi-sig wallet', category: 'Blockchain', subcategory: 'Wallet', official: false, popularity: 80, skills: ['defi-architect'], capabilities: ['custom'] },
	{ id: 'opensea', name: 'OpenSea MCP', description: 'NFT marketplace API', category: 'Blockchain', subcategory: 'NFT', official: false, popularity: 85, skills: ['nft-developer'], capabilities: ['custom'] },
	{ id: 'reservoir', name: 'Reservoir MCP', description: 'NFT liquidity tools', category: 'Blockchain', subcategory: 'NFT', official: false, popularity: 70, skills: ['nft-developer'], capabilities: ['custom'] },

	// ============================================
	// DeFi (346-365)
	// ============================================
	{ id: 'uniswap', name: 'Uniswap MCP', description: 'DEX protocol', category: 'DeFi', subcategory: 'DEX', official: false, popularity: 95, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'sushiswap', name: 'SushiSwap MCP', description: 'Multi-chain DEX', category: 'DeFi', subcategory: 'DEX', official: false, popularity: 75, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'curve', name: 'Curve MCP', description: 'Stablecoin DEX', category: 'DeFi', subcategory: 'DEX', official: false, popularity: 85, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'balancer', name: 'Balancer MCP', description: 'Automated portfolio manager', category: 'DeFi', subcategory: 'DEX', official: false, popularity: 75, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: '1inch', name: '1inch MCP', description: 'DEX aggregator', category: 'DeFi', subcategory: 'Aggregator', official: false, popularity: 85, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'paraswap', name: 'ParaSwap MCP', description: 'Multi-DEX aggregator', category: 'DeFi', subcategory: 'Aggregator', official: false, popularity: 70, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'aave', name: 'Aave MCP', description: 'DeFi lending protocol', category: 'DeFi', subcategory: 'Lending', official: false, popularity: 95, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'compound', name: 'Compound MCP', description: 'Algorithmic money markets', category: 'DeFi', subcategory: 'Lending', official: false, popularity: 85, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'makerdao', name: 'MakerDAO MCP', description: 'DAI stablecoin protocol', category: 'DeFi', subcategory: 'Stablecoin', official: false, popularity: 85, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'lido', name: 'Lido MCP', description: 'Liquid staking', category: 'DeFi', subcategory: 'Staking', official: false, popularity: 90, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'rocketpool', name: 'Rocket Pool MCP', description: 'Decentralized ETH staking', category: 'DeFi', subcategory: 'Staking', official: false, popularity: 75, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'eigenlayer', name: 'EigenLayer MCP', description: 'Restaking protocol', category: 'DeFi', subcategory: 'Staking', official: false, popularity: 80, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'dydx', name: 'dYdX MCP', description: 'Decentralized derivatives', category: 'DeFi', subcategory: 'Derivatives', official: false, popularity: 85, skills: ['defi-architect', 'algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'gmx', name: 'GMX MCP', description: 'Perpetual exchange', category: 'DeFi', subcategory: 'Derivatives', official: false, popularity: 80, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'synthetix', name: 'Synthetix MCP', description: 'Synthetic assets protocol', category: 'DeFi', subcategory: 'Derivatives', official: false, popularity: 75, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'yearn', name: 'Yearn Finance MCP', description: 'Yield aggregator', category: 'DeFi', subcategory: 'Yield', official: false, popularity: 80, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'convex', name: 'Convex MCP', description: 'Curve yield booster', category: 'DeFi', subcategory: 'Yield', official: false, popularity: 75, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'pendle', name: 'Pendle MCP', description: 'Yield trading protocol', category: 'DeFi', subcategory: 'Yield', official: false, popularity: 70, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'morpho', name: 'Morpho MCP', description: 'Lending optimizer', category: 'DeFi', subcategory: 'Lending', official: false, popularity: 70, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'euler', name: 'Euler MCP', description: 'Permissionless lending', category: 'DeFi', subcategory: 'Lending', official: false, popularity: 65, skills: ['defi-architect'], capabilities: ['payment'] },

	// ============================================
	// Trading (366-390)
	// ============================================
	{ id: 'interactive-brokers', name: 'Interactive Brokers MCP', description: 'Professional trading platform', category: 'Trading', subcategory: 'Broker', official: false, popularity: 90, skills: ['algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'td-ameritrade', name: 'TD Ameritrade MCP', description: 'Stock trading API', category: 'Trading', subcategory: 'Broker', official: false, popularity: 80, skills: ['algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'schwab', name: 'Charles Schwab MCP', description: 'Brokerage API', category: 'Trading', subcategory: 'Broker', official: false, popularity: 75, skills: ['algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'robinhood', name: 'Robinhood MCP', description: 'Commission-free trading', category: 'Trading', subcategory: 'Broker', official: false, popularity: 80, skills: [], capabilities: ['payment'] },
	{ id: 'tradingview', name: 'TradingView MCP', description: 'Charting & analysis platform', category: 'Trading', subcategory: 'Analysis', official: false, popularity: 95, skills: ['algorithmic-trading', 'technical-analysis'], capabilities: ['analytics'] },
	{ id: 'polygon-io', name: 'Polygon.io MCP', description: 'Market data API', category: 'Trading', subcategory: 'Data', official: false, popularity: 85, skills: ['algorithmic-trading', 'data-engineer'], capabilities: ['analytics'] },
	{ id: 'alpha-vantage', name: 'Alpha Vantage MCP', description: 'Free stock API', category: 'Trading', subcategory: 'Data', official: false, popularity: 80, skills: ['algorithmic-trading'], capabilities: ['analytics'] },
	{ id: 'iex-cloud', name: 'IEX Cloud MCP', description: 'Financial data platform', category: 'Trading', subcategory: 'Data', official: false, popularity: 80, skills: ['algorithmic-trading'], capabilities: ['analytics'] },
	{ id: 'finnhub', name: 'Finnhub MCP', description: 'Real-time stock API', category: 'Trading', subcategory: 'Data', official: false, popularity: 75, skills: ['algorithmic-trading'], capabilities: ['analytics'] },
	{ id: 'yahoo-finance', name: 'Yahoo Finance MCP', description: 'Financial data', category: 'Trading', subcategory: 'Data', official: false, popularity: 85, skills: [], capabilities: ['analytics'] },
	{ id: 'bloomberg', name: 'Bloomberg API MCP', description: 'Enterprise market data', category: 'Trading', subcategory: 'Data', official: false, popularity: 85, skills: ['algorithmic-trading'], capabilities: ['analytics'] },
	{ id: 'binance', name: 'Binance MCP', description: 'Crypto exchange API', category: 'Trading', subcategory: 'Crypto', official: false, popularity: 95, skills: ['algorithmic-trading', 'defi-architect'], capabilities: ['payment'] },
	{ id: 'kraken', name: 'Kraken MCP', description: 'Crypto exchange', category: 'Trading', subcategory: 'Crypto', official: false, popularity: 80, skills: ['algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'ftx', name: 'Bybit MCP', description: 'Crypto derivatives exchange', category: 'Trading', subcategory: 'Crypto', official: false, popularity: 75, skills: ['algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'kucoin', name: 'KuCoin MCP', description: 'Crypto exchange', category: 'Trading', subcategory: 'Crypto', official: false, popularity: 70, skills: [], capabilities: ['payment'] },
	{ id: 'coingecko', name: 'CoinGecko MCP', description: 'Crypto market data', category: 'Trading', subcategory: 'Data', official: false, popularity: 90, skills: ['blockchain-analyst'], capabilities: ['analytics'] },
	{ id: 'coinmarketcap', name: 'CoinMarketCap MCP', description: 'Crypto prices & market cap', category: 'Trading', subcategory: 'Data', official: false, popularity: 90, skills: [], capabilities: ['analytics'] },
	{ id: 'messari', name: 'Messari MCP', description: 'Crypto research & data', category: 'Trading', subcategory: 'Research', official: false, popularity: 75, skills: ['blockchain-analyst'], capabilities: ['analytics'] },
	{ id: 'glassnode', name: 'Glassnode MCP', description: 'On-chain market intelligence', category: 'Trading', subcategory: 'Research', official: false, popularity: 80, skills: ['blockchain-analyst'], capabilities: ['analytics'] },
	{ id: 'santiment', name: 'Santiment MCP', description: 'Crypto behavioral data', category: 'Trading', subcategory: 'Research', official: false, popularity: 70, skills: ['blockchain-analyst'], capabilities: ['analytics'] },
	{ id: 'quantconnect', name: 'QuantConnect MCP', description: 'Algorithmic trading platform', category: 'Trading', subcategory: 'Algo', official: false, popularity: 80, skills: ['algorithmic-trading'], capabilities: ['code_exec'] },
	{ id: 'backtrader', name: 'Backtrader MCP', description: 'Python backtesting', category: 'Trading', subcategory: 'Algo', official: false, popularity: 70, skills: ['algorithmic-trading'], capabilities: ['code_exec'] },
	{ id: 'freqtrade', name: 'Freqtrade MCP', description: 'Crypto trading bot', category: 'Trading', subcategory: 'Algo', official: false, popularity: 75, skills: ['algorithmic-trading'], capabilities: ['code_exec'] },
	{ id: 'ccxt', name: 'CCXT MCP', description: 'Crypto exchange library', category: 'Trading', subcategory: 'Library', official: false, popularity: 85, skills: ['algorithmic-trading'], capabilities: ['payment'] },
	{ id: 'lunarcrush', name: 'LunarCrush MCP', description: 'Social crypto analytics', category: 'Trading', subcategory: 'Social', official: false, popularity: 65, skills: [], capabilities: ['analytics', 'social_engagement'] },

	// ============================================
	// Prediction Markets (391-405)
	// ============================================
	{ id: 'polymarket', name: 'Polymarket MCP', description: 'Decentralized prediction market', category: 'Prediction Markets', subcategory: 'Crypto', official: false, popularity: 95, skills: ['defi-architect', 'prediction-markets'], capabilities: ['payment'] },
	{ id: 'kalshi', name: 'Kalshi MCP', description: 'Regulated prediction exchange', category: 'Prediction Markets', subcategory: 'Regulated', official: false, popularity: 90, skills: ['prediction-markets'], capabilities: ['payment'] },
	{ id: 'manifold', name: 'Manifold Markets MCP', description: 'Play-money prediction market', category: 'Prediction Markets', subcategory: 'Play Money', official: false, popularity: 80, skills: ['prediction-markets'], capabilities: ['custom'] },
	{ id: 'metaculus', name: 'Metaculus MCP', description: 'Forecasting platform', category: 'Prediction Markets', subcategory: 'Forecasting', official: false, popularity: 75, skills: ['prediction-markets'], capabilities: ['analytics'] },
	{ id: 'predictit', name: 'PredictIt MCP', description: 'Political prediction market', category: 'Prediction Markets', subcategory: 'Political', official: false, popularity: 70, skills: [], capabilities: ['payment'] },
	{ id: 'augur', name: 'Augur MCP', description: 'Decentralized oracle & market', category: 'Prediction Markets', subcategory: 'Crypto', official: false, popularity: 65, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'gnosis-conditional', name: 'Gnosis Conditional Tokens MCP', description: 'Prediction market framework', category: 'Prediction Markets', subcategory: 'Framework', official: false, popularity: 70, skills: ['smart-contracts'], capabilities: ['custom'] },
	{ id: 'insight-prediction', name: 'Insight Prediction MCP', description: 'Event contract exchange', category: 'Prediction Markets', subcategory: 'Events', official: false, popularity: 55, skills: [], capabilities: ['payment'] },
	{ id: 'futuur', name: 'Futuur MCP', description: 'Global prediction market', category: 'Prediction Markets', subcategory: 'Global', official: false, popularity: 50, skills: [], capabilities: ['payment'] },
	{ id: 'hedgehog', name: 'Hedgehog Markets MCP', description: 'Solana prediction market', category: 'Prediction Markets', subcategory: 'Crypto', official: false, popularity: 55, skills: ['solana-developer'], capabilities: ['payment'] },
	{ id: 'zeitgeist', name: 'Zeitgeist MCP', description: 'Polkadot prediction market', category: 'Prediction Markets', subcategory: 'Crypto', official: false, popularity: 50, skills: [], capabilities: ['payment'] },
	{ id: 'azuro', name: 'Azuro MCP', description: 'Betting protocol', category: 'Prediction Markets', subcategory: 'Sports', official: false, popularity: 60, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'sx-bet', name: 'SX Bet MCP', description: 'Sports prediction protocol', category: 'Prediction Markets', subcategory: 'Sports', official: false, popularity: 55, skills: [], capabilities: ['payment'] },
	{ id: 'omen', name: 'Omen MCP', description: 'Gnosis prediction market', category: 'Prediction Markets', subcategory: 'Crypto', official: false, popularity: 55, skills: ['defi-architect'], capabilities: ['payment'] },
	{ id: 'good-judgment', name: 'Good Judgment MCP', description: 'Superforecasting platform', category: 'Prediction Markets', subcategory: 'Forecasting', official: false, popularity: 65, skills: [], capabilities: ['analytics'] }
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
