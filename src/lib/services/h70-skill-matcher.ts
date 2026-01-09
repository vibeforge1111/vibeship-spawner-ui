/**
 * H70 Skill Matcher Service
 *
 * Automatically matches task names/descriptions to relevant H70 skills.
 * Uses keyword matching, category mapping, and fuzzy matching.
 */

/**
 * Skill matching rules - maps keywords to H70 skill IDs
 * Format: keyword -> [primary skill, ...related skills]
 */
const KEYWORD_TO_SKILLS: Record<string, string[]> = {
	// Project Setup & Scaffolding
	'project setup': ['typescript-strict', 'git-workflow', 'vite'],
	'initialize': ['typescript-strict', 'git-workflow'],
	'scaffold': ['nextjs-app-router', 'sveltekit', 'vite'],
	'boilerplate': ['typescript-strict', 'code-quality'],

	// Frontend & UI
	'frontend': ['frontend', 'react-patterns', 'tailwind-css'],
	'ui': ['ui-design', 'tailwind-ui', 'design-systems'],
	'component': ['react-patterns', 'frontend', 'design-systems'],
	'design system': ['design-systems', 'tailwind-css', 'typography'],
	'layout': ['tailwind-css', 'ui-design', 'frontend'],
	'responsive': ['tailwind-css', 'frontend', 'mobile-game-dev'],
	'styling': ['tailwind-css', 'tailwind-ui', 'design-systems'],
	'css': ['tailwind-css', 'tailwind-ui'],
	'tailwind': ['tailwind-css', 'tailwind-ui'],

	// 3D & Graphics
	'three.js': ['threejs-3d-graphics', '3d-web-experience'],
	'threejs': ['threejs-3d-graphics', '3d-web-experience'],
	'3d': ['3d-web-experience', 'threejs-3d-graphics', '3d-modeling'],
	'webgl': ['threejs-3d-graphics', '3d-web-experience'],
	'visualization': ['3d-web-experience', 'threejs-3d-graphics', 'analytics'],
	'animation': ['animation-systems', 'motion-graphics', 'motion-design'],
	'canvas': ['threejs-3d-graphics', 'generative-art'],

	// Backend & API
	'backend': ['backend', 'api-designer', 'supabase-backend'],
	'api': ['api-designer', 'api-design', 'graphql-architect'],
	'rest': ['api-designer', 'api-design'],
	'graphql': ['graphql', 'graphql-architect'],
	'server': ['backend', 'api-designer', 'go-services'],
	'endpoint': ['api-designer', 'api-design', 'backend'],

	// Database
	'database': ['database-architect', 'database-schema-design', 'postgres-wizard'],
	'schema': ['database-schema-design', 'database-architect', 'drizzle-orm'],
	'postgres': ['postgres-wizard', 'database-architect', 'neon-postgres'],
	'sql': ['postgres-wizard', 'database-architect'],
	'migration': ['database-migrations', 'migration-specialist'],
	'orm': ['drizzle-orm', 'prisma'],
	'supabase': ['supabase-backend', 'supabase-security', 'nextjs-supabase-auth'],

	// Authentication
	'auth': ['auth-specialist', 'authentication-oauth', 'nextjs-supabase-auth'],
	'authentication': ['auth-specialist', 'authentication-oauth', 'clerk-auth'],
	'login': ['auth-specialist', 'authentication-oauth'],
	'signup': ['auth-specialist', 'authentication-oauth'],
	'session': ['auth-specialist', 'authentication-oauth'],
	'oauth': ['authentication-oauth', 'auth-specialist'],
	'jwt': ['auth-specialist', 'authentication-oauth'],

	// Testing
	'test': ['test-architect', 'testing-automation', 'testing-strategies'],
	'testing': ['testing-automation', 'test-architect', 'qa-engineering'],
	'unit test': ['test-architect', 'testing-automation'],
	'integration test': ['testing-automation', 'test-architect'],
	'e2e': ['testing-automation', 'browser-automation'],
	'qa': ['qa-engineering', 'testing-automation'],

	// DevOps & CI/CD
	'deploy': ['vercel-deployment', 'devops', 'ci-cd-pipeline'],
	'deployment': ['vercel-deployment', 'devops', 'ci-cd-pipeline'],
	'ci/cd': ['ci-cd-pipeline', 'cicd-pipelines', 'claude-code-cicd'],
	'pipeline': ['ci-cd-pipeline', 'cicd-pipelines'],
	'docker': ['docker', 'docker-specialist', 'docker-containerization'],
	'kubernetes': ['kubernetes', 'kubernetes-deployment'],
	'infrastructure': ['infra-architect', 'infrastructure-as-code'],

	// Security
	'security': ['security', 'security-hardening', 'security-owasp'],
	'secure': ['security-hardening', 'security', 'llm-security-audit'],
	'vulnerability': ['security-owasp', 'security-hardening'],
	'owasp': ['security-owasp', 'security-hardening'],

	// AI & LLM
	'ai': ['llm-architect', 'ai-agents-architect', 'ai-product'],
	'llm': ['llm-architect', 'ai-agents-architect', 'prompt-engineer'],
	'agent': ['ai-agents-architect', 'autonomous-agents', 'multi-agent-orchestration'],
	'prompt': ['prompt-engineer', 'prompt-engineering-creative'],
	'rag': ['rag-engineer', 'rag-implementation'],
	'embedding': ['vector-specialist', 'semantic-search'],
	'openai': ['llm-architect', 'prompt-engineer'],
	'anthropic': ['llm-architect', 'prompt-engineer'],
	'claude': ['llm-architect', 'claude-code-hooks', 'claude-code-commands'],

	// Real-time
	'realtime': ['realtime-engineer', 'websocket-realtime', 'websockets-realtime'],
	'websocket': ['websocket-realtime', 'websockets-realtime', 'realtime-engineer'],
	'sse': ['realtime-engineer', 'websocket-realtime'],
	'live': ['realtime-engineer', 'websocket-realtime'],

	// State Management
	'state': ['state-management', 'react-patterns'],
	'store': ['state-management', 'react-patterns'],
	'zustand': ['state-management', 'react-patterns'],
	'redux': ['state-management', 'react-patterns'],

	// Performance
	'performance': ['performance-hunter', 'performance-optimization', 'performance-thinker'],
	'optimize': ['performance-optimization', 'performance-hunter', 'codebase-optimization'],
	'speed': ['performance-optimization', 'performance-hunter'],

	// Documentation
	'documentation': ['docs-engineer', 'technical-writer'],
	'docs': ['docs-engineer', 'technical-writer'],
	'readme': ['docs-engineer', 'technical-writer'],

	// Frameworks
	'nextjs': ['nextjs-app-router', 'nextjs-supabase-auth'],
	'next.js': ['nextjs-app-router', 'nextjs-supabase-auth'],
	'react': ['react-patterns', 'react-native-specialist'],
	'svelte': ['sveltekit', 'svelte-kit'],
	'sveltekit': ['sveltekit', 'svelte-kit'],
	'vue': ['vue-nuxt'],
	'nuxt': ['vue-nuxt'],
	'angular': ['angular'],

	// Mobile
	'mobile': ['react-native-specialist', 'expo', 'ios-swift-specialist'],
	'ios': ['ios-swift-specialist', 'react-native-specialist'],
	'android': ['react-native-specialist', 'expo'],
	'react native': ['react-native-specialist', 'expo'],

	// Game Development
	'game': ['game-development', 'game-design', 'game-design-core'],
	'gamedev': ['game-development', 'game-design'],
	'unity': ['unity-development', 'unity-llm-integration'],
	'godot': ['godot-development', 'godot-llm-integration'],
	'unreal': ['unreal-engine', 'unreal-llm-integration'],
	'phaser': ['game-development', 'game-design'],

	// Payments
	'payment': ['stripe-integration', 'subscription-billing'],
	'stripe': ['stripe-integration', 'subscription-billing'],
	'billing': ['subscription-billing', 'stripe-integration'],
	'subscription': ['subscription-billing', 'stripe-integration'],

	// Analytics
	'analytics': ['analytics', 'analytics-architecture', 'product-analytics-engineering'],
	'tracking': ['analytics', 'segment-cdp'],
	'metrics': ['analytics', 'observability'],

	// Marketing & Growth
	'marketing': ['marketing', 'marketing-fundamentals', 'growth-strategy'],
	'growth': ['growth-strategy', 'growth-loops', 'product-led-growth'],
	'landing': ['landing-page-design', 'copywriting'],
	'conversion': ['conversion-rate-optimization', 'landing-page-design'],
	'seo': ['seo'],

	// Content
	'content': ['content-strategy', 'content-creation', 'copywriting'],
	'copywriting': ['copywriting', 'content-creation'],
	'blog': ['blog-writing', 'content-strategy'],

	// Community
	'community': ['community-building', 'community-strategy', 'community-growth'],
	'discord': ['discord-bot-architect', 'discord-mastery'],
	'slack': ['slack-bot-builder'],

	// Blockchain & Web3
	'blockchain': ['blockchain-defi', 'smart-contract-engineer'],
	'web3': ['web3-gaming', 'web3-community', 'wallet-integration'],
	'smart contract': ['smart-contract-engineer', 'smart-contract-auditor'],
	'solidity': ['smart-contract-engineer', 'evm-deep-dive'],
	'nft': ['nft-engineer', 'nft-systems'],
	'defi': ['defi-architect', 'blockchain-defi'],

	// E-commerce & Business
	'ecommerce': ['ecommerce-architect', 'stripe-integration', 'inventory-management'],
	'e-commerce': ['ecommerce-architect', 'stripe-integration'],
	'shop': ['ecommerce-architect', 'stripe-integration'],
	'cart': ['ecommerce-architect', 'frontend'],
	'checkout': ['stripe-integration', 'ecommerce-architect'],
	'inventory': ['inventory-management', 'database-architect'],
	'order': ['ecommerce-architect', 'database-architect'],
	'product': ['ecommerce-architect', 'database-schema-design'],

	// Data & Analytics
	'data': ['data-engineer', 'analytics', 'database-architect'],
	'etl': ['data-engineer', 'data-pipeline'],
	'pipeline': ['data-pipeline', 'ci-cd-pipeline'],
	'warehouse': ['data-engineer', 'analytics-architecture'],
	'dashboard': ['analytics', 'frontend', 'visualization'],
	'report': ['analytics', 'data-engineer'],
	'chart': ['visualization', 'frontend', 'analytics'],
	'graph': ['visualization', 'graphql', 'analytics'],

	// File & Media
	'file': ['file-upload', 'storage', 'media-processing'],
	'upload': ['file-upload', 'storage', 'media-processing'],
	'download': ['file-upload', 'storage'],
	'storage': ['storage', 'cloudflare-r2', 's3'],
	's3': ['storage', 'aws-specialist'],
	'image': ['media-processing', 'image-optimization', 'computer-vision'],
	'video': ['media-processing', 'video-streaming'],
	'audio': ['media-processing', 'audio-engineering'],
	'pdf': ['pdf-generation', 'media-processing'],

	// Search & Discovery
	'search': ['search-engineer', 'elasticsearch', 'semantic-search'],
	'elasticsearch': ['elasticsearch', 'search-engineer'],
	'algolia': ['search-engineer', 'frontend'],
	'filter': ['frontend', 'database-architect', 'search-engineer'],
	'sort': ['frontend', 'database-architect'],

	// Communication & Notifications
	'email': ['email-specialist', 'notification-systems'],
	'notification': ['notification-systems', 'realtime-engineer'],
	'push': ['notification-systems', 'mobile'],
	'sms': ['notification-systems', 'twilio'],
	'chat': ['chat-systems', 'realtime-engineer', 'websocket-realtime'],
	'messaging': ['chat-systems', 'realtime-engineer'],

	// Localization & i18n
	'i18n': ['i18n-specialist', 'frontend'],
	'internationalization': ['i18n-specialist', 'frontend'],
	'localization': ['i18n-specialist', 'frontend'],
	'translation': ['i18n-specialist', 'content-strategy'],
	'multilingual': ['i18n-specialist', 'frontend'],

	// Scheduling & Calendar
	'schedule': ['scheduling-systems', 'calendar-integration'],
	'calendar': ['calendar-integration', 'scheduling-systems'],
	'booking': ['scheduling-systems', 'ecommerce-architect'],
	'appointment': ['scheduling-systems', 'calendar-integration'],
	'cron': ['task-scheduling', 'backend'],

	// Maps & Location
	'map': ['maps-integration', 'geospatial'],
	'location': ['geospatial', 'maps-integration'],
	'geo': ['geospatial', 'maps-integration'],
	'gps': ['geospatial', 'mobile'],

	// Form & Input
	'form': ['form-validation', 'frontend', 'react-patterns'],
	'validation': ['form-validation', 'zod-validation', 'security'],
	'input': ['form-validation', 'frontend'],
	'wizard': ['frontend', 'form-validation', 'ux-design'],

	// Admin & CMS
	'admin': ['admin-panel', 'frontend', 'backend'],
	'cms': ['cms-architect', 'content-strategy'],
	'dashboard': ['admin-panel', 'analytics', 'frontend'],
	'backoffice': ['admin-panel', 'backend'],

	// Social & Sharing
	'social': ['social-features', 'community-building'],
	'share': ['social-features', 'frontend'],
	'like': ['social-features', 'database-architect'],
	'comment': ['social-features', 'realtime-engineer'],
	'follow': ['social-features', 'database-architect'],
	'feed': ['social-features', 'realtime-engineer', 'algorithm-design'],

	// Monitoring & Logging
	'monitor': ['observability', 'monitoring-alerting'],
	'log': ['logging', 'observability'],
	'trace': ['observability', 'tracing'],
	'alert': ['monitoring-alerting', 'notification-systems'],
	'error tracking': ['error-tracking', 'observability'],
	'sentry': ['error-tracking', 'observability'],

	// ML & Data Science
	'machine learning': ['ml-engineer', 'data-scientist'],
	'ml': ['ml-engineer', 'data-scientist'],
	'model': ['ml-engineer', 'llm-architect'],
	'training': ['ml-engineer', 'data-scientist'],
	'prediction': ['ml-engineer', 'analytics'],
	'classification': ['ml-engineer', 'computer-vision'],
	'regression': ['ml-engineer', 'data-scientist'],
	'neural': ['ml-engineer', 'deep-learning'],
	'tensorflow': ['ml-engineer', 'deep-learning'],
	'pytorch': ['ml-engineer', 'deep-learning'],

	// Workflow & Automation
	'workflow': ['workflow-automation', 'process-automation'],
	'automation': ['automation-engineer', 'process-automation'],
	'automate': ['automation-engineer', 'ci-cd-pipeline'],
	'trigger': ['workflow-automation', 'event-driven'],
	'hook': ['webhook-integration', 'event-driven'],
	'webhook': ['webhook-integration', 'api-designer'],

	// Accessibility
	'accessibility': ['accessibility-specialist', 'frontend'],
	'a11y': ['accessibility-specialist', 'frontend'],
	'wcag': ['accessibility-specialist', 'frontend'],
	'screen reader': ['accessibility-specialist', 'frontend'],

	// Legal & Compliance
	'gdpr': ['compliance-engineer', 'security'],
	'compliance': ['compliance-engineer', 'security-hardening'],
	'privacy': ['privacy-engineer', 'security'],
	'consent': ['privacy-engineer', 'frontend'],
	'audit': ['audit-specialist', 'security-hardening'],

	// Multi-tenancy & SaaS
	'tenant': ['multi-tenancy', 'saas-architect'],
	'multi-tenant': ['multi-tenancy', 'saas-architect'],
	'saas': ['saas-architect', 'subscription-billing'],
	'workspace': ['multi-tenancy', 'collaboration-tools'],
	'organization': ['multi-tenancy', 'database-architect'],

	// Caching & Performance
	'cache': ['caching-specialist', 'redis', 'performance-optimization'],
	'redis': ['redis', 'caching-specialist'],
	'memcached': ['caching-specialist', 'performance-optimization'],
	'cdn': ['cdn-specialist', 'performance-optimization'],

	// Queue & Messaging
	'queue': ['queue-systems', 'message-broker'],
	'message queue': ['message-broker', 'queue-systems'],
	'rabbitmq': ['message-broker', 'queue-systems'],
	'kafka': ['kafka', 'event-streaming'],
	'pubsub': ['event-driven', 'realtime-engineer'],

	// Version Control & Collaboration
	'git': ['git-workflow', 'version-control'],
	'github': ['github-actions', 'git-workflow'],
	'gitlab': ['gitlab-ci', 'git-workflow'],
	'pr': ['code-review', 'git-workflow'],
	'code review': ['code-review', 'engineering-manager'],

	// Architecture Patterns
	'microservice': ['microservices-architect', 'api-designer'],
	'monolith': ['backend', 'architecture-patterns'],
	'serverless': ['serverless-architect', 'lambda'],
	'event driven': ['event-driven', 'message-broker'],
	'cqrs': ['cqrs-architect', 'event-driven'],
	'domain driven': ['ddd-architect', 'architecture-patterns'],
	'ddd': ['ddd-architect', 'architecture-patterns'],
	'clean architecture': ['architecture-patterns', 'backend'],

	// CLI & Tools
	'cli': ['cli-architect', 'terminal-tools'],
	'command line': ['cli-architect', 'terminal-tools'],
	'terminal': ['terminal-tools', 'cli-architect'],
	'script': ['scripting', 'automation-engineer'],
	'bash': ['scripting', 'devops'],

	// PDF & Documents
	'pdf': ['pdf-generation', 'document-processing'],
	'document': ['document-processing', 'content-strategy'],
	'export': ['pdf-generation', 'data-export'],
	'import': ['data-import', 'etl'],

	// Rate Limiting & Throttling
	'rate limit': ['api-security', 'backend'],
	'throttle': ['api-security', 'performance-optimization'],
	'quota': ['api-security', 'subscription-billing'],
};

/**
 * Task type to primary skill mapping
 */
const TASK_TYPE_TO_SKILLS: Record<string, string[]> = {
	'Project Setup': ['typescript-strict', 'git-workflow', 'code-quality'],
	'Design System': ['design-systems', 'tailwind-css', 'ui-design', 'typography'],
	'Authentication': ['auth-specialist', 'authentication-oauth', 'security-hardening'],
	'Database': ['database-architect', 'database-schema-design', 'postgres-wizard'],
	'API': ['api-designer', 'api-design', 'graphql-architect'],
	'Frontend': ['frontend', 'react-patterns', 'tailwind-css'],
	'Backend': ['backend', 'api-designer', 'database-architect'],
	'Testing': ['test-architect', 'testing-automation', 'qa-engineering'],
	'CI/CD': ['ci-cd-pipeline', 'cicd-pipelines', 'devops'],
	'Deployment': ['vercel-deployment', 'devops', 'ci-cd-pipeline'],
	'Security': ['security-hardening', 'security-owasp', 'security'],
	'Performance': ['performance-hunter', 'performance-optimization', 'codebase-optimization'],
	'Documentation': ['docs-engineer', 'technical-writer'],
	'3D Visualization': ['3d-web-experience', 'threejs-3d-graphics', 'animation-systems'],
	'Real-time': ['realtime-engineer', 'websocket-realtime'],
	'AI Integration': ['llm-architect', 'ai-agents-architect', 'prompt-engineer'],
};

/**
 * Extract keywords from task name/description
 */
function extractKeywords(text: string): string[] {
	const normalized = text.toLowerCase();
	const keywords: string[] = [];

	// Check multi-word phrases first
	const phrases = Object.keys(KEYWORD_TO_SKILLS).filter(k => k.includes(' '));
	for (const phrase of phrases) {
		if (normalized.includes(phrase)) {
			keywords.push(phrase);
		}
	}

	// Then check individual words
	const words = normalized.split(/[\s\-_:,.]+/).filter(w => w.length > 2);
	for (const word of words) {
		if (KEYWORD_TO_SKILLS[word]) {
			keywords.push(word);
		}
	}

	return [...new Set(keywords)];
}

/**
 * Match a task to relevant H70 skills
 * @param taskName - Name of the task
 * @param taskDescription - Optional task description for better matching
 * @param maxSkills - Maximum skills to return (default 5, was 3)
 */
export function matchTaskToSkills(
	taskName: string,
	taskDescription?: string,
	maxSkills: number = 5
): string[] {
	const matchedSkills: Map<string, number> = new Map();

	// Combine task name and description for matching
	const fullText = `${taskName} ${taskDescription || ''}`;

	// 1. Check task type mapping first (highest priority)
	for (const [taskType, skills] of Object.entries(TASK_TYPE_TO_SKILLS)) {
		if (taskName.toLowerCase().includes(taskType.toLowerCase())) {
			skills.forEach((skill, index) => {
				const currentScore = matchedSkills.get(skill) || 0;
				matchedSkills.set(skill, currentScore + (10 - index)); // Higher score for earlier matches
			});
		}
	}

	// 2. Extract and match keywords
	const keywords = extractKeywords(fullText);
	for (const keyword of keywords) {
		const skills = KEYWORD_TO_SKILLS[keyword] || [];
		skills.forEach((skill, index) => {
			const currentScore = matchedSkills.get(skill) || 0;
			matchedSkills.set(skill, currentScore + (5 - index)); // Lower priority than task type
		});
	}

	// 3. Sort by score and return top matches
	const sortedSkills = [...matchedSkills.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([skill]) => skill)
		.slice(0, maxSkills);

	return sortedSkills;
}

/**
 * Match multiple tasks to skills (batch operation)
 */
export function matchTasksToSkills(
	tasks: Array<{ name: string; description?: string }>,
	maxSkillsPerTask: number = 3
): Map<string, string[]> {
	const result = new Map<string, string[]>();

	for (const task of tasks) {
		const skills = matchTaskToSkills(task.name, task.description, maxSkillsPerTask);
		result.set(task.name, skills);
	}

	return result;
}

/**
 * Get all unique skills needed for a set of tasks
 */
export function getAllRequiredSkills(
	tasks: Array<{ name: string; description?: string }>,
	maxSkillsPerTask: number = 3
): string[] {
	const allSkills = new Set<string>();

	for (const task of tasks) {
		const skills = matchTaskToSkills(task.name, task.description, maxSkillsPerTask);
		skills.forEach(skill => allSkills.add(skill));
	}

	return [...allSkills];
}

/**
 * Get skill priority/relevance for a mission
 */
export function getSkillPriorities(
	tasks: Array<{ name: string; description?: string }>
): Array<{ skillId: string; score: number; usedInTasks: string[] }> {
	const skillScores = new Map<string, { score: number; tasks: string[] }>();

	for (const task of tasks) {
		const skills = matchTaskToSkills(task.name, task.description, 5);
		skills.forEach((skill, index) => {
			const existing = skillScores.get(skill) || { score: 0, tasks: [] };
			existing.score += (5 - index); // Higher score for higher priority matches
			existing.tasks.push(task.name);
			skillScores.set(skill, existing);
		});
	}

	return [...skillScores.entries()]
		.map(([skillId, { score, tasks }]) => ({ skillId, score, usedInTasks: tasks }))
		.sort((a, b) => b.score - a.score);
}

export { KEYWORD_TO_SKILLS, TASK_TYPE_TO_SKILLS };
