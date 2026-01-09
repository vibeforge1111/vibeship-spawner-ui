/**
 * PRD Analyzer
 *
 * Analyzes a Product Requirements Document and automatically generates
 * implementation tasks that can be converted to canvas workflow nodes.
 *
 * Uses H70 keyword mappings (391 keywords) for comprehensive skill matching.
 */

import type { Skill } from '$lib/stores/skills.svelte';
import { KEYWORD_TO_SKILLS } from '$lib/services/h70-skill-matcher';

export interface PRDAnalysis {
	projectName: string;
	projectType: 'saas' | 'webapp' | 'mobile' | 'api' | 'cli' | 'library' | 'general';
	features: ExtractedFeature[];
	techHints: string[];
	constraints: string[];
	suggestedStack: SuggestedStack;
}

export interface ExtractedFeature {
	name: string;
	description: string;
	priority: 'must-have' | 'should-have' | 'nice-to-have';
	category: string;
}

export interface SuggestedStack {
	frontend?: string[];
	backend?: string[];
	database?: string[];
	auth?: string[];
	payments?: string[];
	deployment?: string[];
}

export interface GeneratedTask {
	id: string;
	title: string;
	description: string;
	skillMatch: string | null;
	category: string;
	phase: number;
	dependsOn: string[];
}

// Keywords that indicate different project types
const PROJECT_TYPE_KEYWORDS: Record<string, string[]> = {
	saas: ['saas', 'subscription', 'tenant', 'billing', 'dashboard', 'admin panel', 'user management'],
	webapp: ['web app', 'website', 'landing page', 'spa', 'single page'],
	mobile: ['mobile', 'ios', 'android', 'react native', 'flutter', 'app store'],
	api: ['api', 'rest', 'graphql', 'endpoint', 'microservice', 'backend only'],
	cli: ['cli', 'command line', 'terminal', 'script'],
	library: ['library', 'package', 'npm', 'sdk', 'framework']
};

// Feature keywords to categories (expanded for better detection)
const FEATURE_CATEGORIES: Record<string, string[]> = {
	auth: ['auth', 'login', 'signup', 'register', 'password', 'oauth', 'sso', 'jwt', 'session', 'user', 'account', 'permission', 'role'],
	payments: ['payment', 'stripe', 'billing', 'subscription', 'checkout', 'cart', 'pricing', 'invoice', 'refund', 'transaction'],
	database: ['database', 'storage', 'crud', 'data', 'schema', 'model', 'entity', 'postgres', 'mysql', 'mongodb', 'supabase', 'orm'],
	frontend: ['ui', 'interface', 'component', 'page', 'view', 'form', 'layout', 'design', 'responsive', 'mobile-first', 'tailwind'],
	backend: ['api', 'endpoint', 'server', 'route', 'controller', 'service', 'rest', 'graphql', 'microservice'],
	realtime: ['realtime', 'websocket', 'live', 'notification', 'push', 'chat', 'messaging', 'sync', 'streaming'],
	search: ['search', 'filter', 'query', 'elasticsearch', 'algolia', 'full-text', 'fuzzy'],
	analytics: ['analytics', 'tracking', 'metrics', 'dashboard', 'report', 'insight', 'visualization', 'chart'],
	email: ['email', 'notification', 'smtp', 'sendgrid', 'mailgun', 'newsletter', 'template'],
	file: ['file', 'upload', 'storage', 's3', 'image', 'media', 'video', 'document', 'pdf'],
	ai: ['ai', 'ml', 'machine learning', 'llm', 'gpt', 'claude', 'openai', 'anthropic', 'embedding', 'vector', 'rag', 'agent', 'chatbot'],
	testing: ['test', 'testing', 'unit test', 'e2e', 'integration', 'qa', 'cypress', 'playwright', 'vitest', 'jest'],
	deployment: ['deploy', 'ci/cd', 'docker', 'kubernetes', 'vercel', 'aws', 'gcp', 'azure', 'pipeline', 'infrastructure'],
	security: ['security', 'secure', 'encrypt', 'https', 'cors', 'csrf', 'xss', 'audit', 'vulnerability', 'owasp'],
	performance: ['performance', 'speed', 'optimize', 'cache', 'cdn', 'lazy', 'prefetch', 'bundle'],
	mobile: ['mobile', 'ios', 'android', 'react native', 'flutter', 'expo', 'app store', 'responsive'],
	blockchain: ['blockchain', 'web3', 'crypto', 'nft', 'smart contract', 'wallet', 'ethereum', 'solana', 'defi'],
	ecommerce: ['ecommerce', 'e-commerce', 'shop', 'store', 'product', 'inventory', 'order', 'shipping'],
	community: ['community', 'forum', 'social', 'follow', 'like', 'comment', 'feed', 'discord', 'slack'],
	marketing: ['marketing', 'seo', 'landing', 'conversion', 'growth', 'campaign', 'funnel']
};

// Skill mappings for different feature categories (expanded with H70 skills)
const CATEGORY_TO_SKILLS: Record<string, string[]> = {
	auth: ['auth-specialist', 'authentication-oauth', 'nextjs-supabase-auth', 'clerk-auth', 'supabase-security'],
	payments: ['stripe-integration', 'subscription-billing', 'fintech-integration', 'derivatives-pricing'],
	database: ['database-architect', 'database-schema-design', 'postgres-wizard', 'drizzle-orm', 'prisma'],
	frontend: ['frontend', 'react-patterns', 'nextjs-app-router', 'sveltekit', 'tailwind-css', 'design-systems'],
	backend: ['backend', 'api-designer', 'api-design', 'go-services', 'graphql-architect'],
	realtime: ['realtime-engineer', 'websocket-realtime', 'websockets-realtime'],
	search: ['elasticsearch', 'search-engineer', 'semantic-search'],
	analytics: ['analytics', 'analytics-architecture', 'product-analytics-engineering', 'data-pipeline'],
	email: ['email-specialist', 'notification-systems'],
	file: ['file-upload', 'storage', 'media-processing', 'cloudflare-r2'],
	ai: ['llm-architect', 'ai-agents-architect', 'prompt-engineer', 'rag-engineer', 'multi-agent-orchestration'],
	testing: ['test-architect', 'testing-automation', 'qa-engineering', 'browser-automation'],
	deployment: ['ci-cd-pipeline', 'cicd-pipelines', 'vercel-deployment', 'docker', 'kubernetes'],
	security: ['security', 'security-hardening', 'security-owasp', 'llm-security-audit'],
	performance: ['performance-hunter', 'performance-optimization', 'caching-specialist'],
	mobile: ['react-native-specialist', 'expo', 'ios-swift-specialist', 'flutter-mobile'],
	blockchain: ['blockchain-defi', 'smart-contract-engineer', 'nft-engineer'],
	ecommerce: ['ecommerce-architect', 'inventory-management'],
	community: ['community-building', 'discord-bot-architect'],
	marketing: ['marketing', 'growth-strategy', 'seo'],
	general: ['typescript-strict', 'code-quality', 'git-workflow']
};

/**
 * Analyze a PRD document and extract key information
 */
export function analyzePRD(prdContent: string): PRDAnalysis {
	const lines = prdContent.toLowerCase();

	// Detect project type
	let projectType: PRDAnalysis['projectType'] = 'general';
	for (const [type, keywords] of Object.entries(PROJECT_TYPE_KEYWORDS)) {
		if (keywords.some(kw => lines.includes(kw))) {
			projectType = type as PRDAnalysis['projectType'];
			break;
		}
	}

	// Extract project name from first heading
	const nameMatch = prdContent.match(/^#\s+(.+?)(?:\n|$)/m);
	const projectName = nameMatch ? nameMatch[1].replace(/product requirements?.*/i, '').trim() : 'New Project';

	// Extract features
	const features = extractFeatures(prdContent);

	// Extract tech hints
	const techHints = extractTechHints(prdContent);

	// Extract constraints
	const constraints = extractConstraints(prdContent);

	// Suggest stack based on features and type
	const suggestedStack = suggestStack(projectType, features, techHints);

	return {
		projectName: projectName || 'New Project',
		projectType,
		features,
		techHints,
		constraints,
		suggestedStack
	};
}

/**
 * Extract features from PRD content
 *
 * COMPREHENSIVE EXTRACTION: Scans multiple formats:
 * - Bulleted/numbered lists
 * - Markdown headings
 * - Paragraph content with keywords
 * - User story format ("As a user, I want...")
 */
function extractFeatures(content: string): ExtractedFeature[] {
	const features: ExtractedFeature[] = [];
	const seenFeatures = new Set<string>(); // Avoid duplicates
	const lines = content.split('\n');

	let inFeaturesSection = false;

	for (const line of lines) {
		const lowerLine = line.toLowerCase();
		const trimmedLine = line.trim();

		// Detect features/requirements section
		if (lowerLine.includes('feature') || lowerLine.includes('requirement') ||
			lowerLine.includes('user stor') || lowerLine.includes('functional spec') ||
			lowerLine.includes('capabilities') || lowerLine.includes('functionality')) {
			inFeaturesSection = true;
			continue;
		}

		// Detect end of features section (new major section)
		if (inFeaturesSection && /^##[^#]/.test(line) && !lowerLine.includes('feature')) {
			inFeaturesSection = false;
		}

		// Method 1: Extract numbered or bulleted features
		const bulletMatch = trimmedLine.match(/^[-*•]\s*\*?\*?(.+?)\*?\*?$/);
		const numberedMatch = trimmedLine.match(/^\d+[.)]\s*\*?\*?(.+?)\*?\*?$/);
		const featureMatch = bulletMatch || numberedMatch;

		if (featureMatch) {
			const rawName = featureMatch[1].trim();
			// Split on : or - for name and description
			const colonSplit = rawName.split(/[:\-–]/);
			const name = colonSplit[0].trim().replace(/\*\*/g, '');
			const description = colonSplit.slice(1).join(':').trim() || name;

			if (name.length > 2 && name.length < 150 && !seenFeatures.has(name.toLowerCase())) {
				seenFeatures.add(name.toLowerCase());
				features.push(createFeature(name, description, lowerLine));
			}
		}

		// Method 2: Extract from headings (### Feature Name)
		const headingMatch = trimmedLine.match(/^#{2,4}\s+(.+)$/);
		if (headingMatch) {
			const headingText = headingMatch[1].trim();
			// Skip meta-sections
			if (!['overview', 'introduction', 'summary', 'table of contents', 'appendix'].some(
				skip => headingText.toLowerCase().includes(skip)
			)) {
				if (headingText.length > 2 && headingText.length < 100 && !seenFeatures.has(headingText.toLowerCase())) {
					seenFeatures.add(headingText.toLowerCase());
					features.push(createFeature(headingText, `Implement ${headingText}`, lowerLine));
				}
			}
		}

		// Method 3: User story format ("As a [role], I want [feature]...")
		const userStoryMatch = trimmedLine.match(/as a .*?(?:i want|i need|i should be able to)\s+(.+?)(?:so that|$)/i);
		if (userStoryMatch) {
			const feature = userStoryMatch[1].trim().replace(/[.,]$/, '');
			if (feature.length > 5 && feature.length < 150 && !seenFeatures.has(feature.toLowerCase())) {
				seenFeatures.add(feature.toLowerCase());
				features.push(createFeature(feature, trimmedLine, lowerLine));
			}
		}
	}

	// Method 4: If still few features, extract from general content by detecting keywords
	if (features.length < 3) {
		const lowerContent = content.toLowerCase();

		for (const [category, keywords] of Object.entries(FEATURE_CATEGORIES)) {
			// Count how many keywords from this category appear
			const matchedKeywords = keywords.filter(kw => lowerContent.includes(kw));

			if (matchedKeywords.length >= 2) { // At least 2 keywords for confidence
				const featureName = `${capitalize(category)} System`;
				if (!seenFeatures.has(featureName.toLowerCase())) {
					seenFeatures.add(featureName.toLowerCase());
					features.push({
						name: featureName,
						description: `Implement ${category} functionality (detected: ${matchedKeywords.slice(0, 3).join(', ')})`,
						priority: 'should-have',
						category
					});
				}
			}
		}
	}

	// Method 5: Extract features from paragraph patterns
	const paragraphs = content.split(/\n\n+/);
	for (const para of paragraphs) {
		// Look for patterns like "The system should...", "Users can...", "Support for..."
		const actionPatterns = [
			/(?:the system|application|app|platform) (?:should|will|must|can) ([^.]+)/gi,
			/(?:users?|customers?) (?:can|will be able to|should be able to) ([^.]+)/gi,
			/(?:support for|enable|allow|provide) ([^.]+)/gi,
			/implement(?:ing|ation of)? ([^.]+)/gi
		];

		for (const pattern of actionPatterns) {
			let match;
			while ((match = pattern.exec(para)) !== null) {
				const feature = match[1].trim();
				if (feature.length > 10 && feature.length < 100 && !seenFeatures.has(feature.toLowerCase())) {
					seenFeatures.add(feature.toLowerCase());
					features.push(createFeature(feature, para.substring(0, 200), para.toLowerCase()));
				}
			}
		}
	}

	return features;
}

/**
 * Helper to create a feature with proper category and priority detection
 */
function createFeature(name: string, description: string, contextLine: string): ExtractedFeature {
	// Determine category from keywords
	let category = 'general';
	for (const [cat, keywords] of Object.entries(FEATURE_CATEGORIES)) {
		if (keywords.some(kw => contextLine.includes(kw) || name.toLowerCase().includes(kw))) {
			category = cat;
			break;
		}
	}

	// Determine priority
	let priority: ExtractedFeature['priority'] = 'should-have';
	if (contextLine.includes('must') || contextLine.includes('critical') ||
		contextLine.includes('essential') || contextLine.includes('required') ||
		contextLine.includes('core') || contextLine.includes('mvp')) {
		priority = 'must-have';
	} else if (contextLine.includes('nice') || contextLine.includes('optional') ||
		contextLine.includes('future') || contextLine.includes('phase 2') ||
		contextLine.includes('later') || contextLine.includes('v2')) {
		priority = 'nice-to-have';
	}

	return {
		name: name.replace(/\*\*/g, ''),
		description: description.substring(0, 300),
		priority,
		category
	};
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Extract technology hints from PRD
 */
function extractTechHints(content: string): string[] {
	const hints: string[] = [];
	const techKeywords = [
		'react', 'vue', 'svelte', 'angular', 'next.js', 'nextjs', 'nuxt',
		'node', 'express', 'fastify', 'nest',
		'python', 'django', 'flask', 'fastapi',
		'postgres', 'mysql', 'mongodb', 'redis', 'supabase', 'firebase',
		'aws', 'gcp', 'azure', 'vercel', 'netlify',
		'docker', 'kubernetes', 'terraform',
		'stripe', 'twilio', 'sendgrid',
		'typescript', 'javascript', 'go', 'rust'
	];

	const lowerContent = content.toLowerCase();
	for (const tech of techKeywords) {
		if (lowerContent.includes(tech)) {
			hints.push(tech);
		}
	}

	return [...new Set(hints)];
}

/**
 * Extract constraints from PRD
 */
function extractConstraints(content: string): string[] {
	const constraints: string[] = [];
	const lines = content.split('\n');

	let inConstraintsSection = false;

	for (const line of lines) {
		const lowerLine = line.toLowerCase();

		if (lowerLine.includes('constraint') || lowerLine.includes('limitation') || lowerLine.includes('requirement')) {
			inConstraintsSection = true;
			continue;
		}

		if (inConstraintsSection && line.startsWith('##')) {
			inConstraintsSection = false;
		}

		if (inConstraintsSection && line.match(/^[\s]*[-*]/)) {
			const constraint = line.replace(/^[\s]*[-*]\s*/, '').trim();
			if (constraint.length > 5) {
				constraints.push(constraint);
			}
		}
	}

	return constraints;
}

/**
 * Suggest a tech stack based on project type and features
 */
function suggestStack(
	projectType: PRDAnalysis['projectType'],
	features: ExtractedFeature[],
	techHints: string[]
): SuggestedStack {
	const stack: SuggestedStack = {};

	// Default suggestions based on project type
	switch (projectType) {
		case 'saas':
		case 'webapp':
			stack.frontend = techHints.includes('svelte') ? ['SvelteKit'] : ['Next.js', 'React'];
			stack.backend = ['Node.js', 'TypeScript'];
			stack.database = techHints.includes('supabase') ? ['Supabase'] : ['PostgreSQL'];
			break;
		case 'mobile':
			stack.frontend = ['React Native'];
			stack.backend = ['Node.js'];
			stack.database = ['Supabase'];
			break;
		case 'api':
			stack.backend = ['Node.js', 'Express'];
			stack.database = ['PostgreSQL'];
			break;
		default:
			stack.frontend = ['Next.js'];
			stack.backend = ['Node.js'];
	}

	// Add auth if needed
	const hasAuth = features.some(f => f.category === 'auth');
	if (hasAuth) {
		stack.auth = techHints.includes('supabase') ? ['Supabase Auth'] : ['NextAuth.js'];
	}

	// Add payments if needed
	const hasPayments = features.some(f => f.category === 'payments');
	if (hasPayments) {
		stack.payments = ['Stripe'];
	}

	// Add deployment
	stack.deployment = ['Vercel', 'Docker'];

	return stack;
}

/**
 * Generate implementation tasks from PRD analysis
 *
 * DYNAMIC GENERATION: Tasks are created based on actual PRD content,
 * not a fixed template. Different PRDs will generate different workflows.
 */
export function generateTasksFromPRD(
	analysis: PRDAnalysis,
	availableSkills: Skill[]
): GeneratedTask[] {
	const tasks: GeneratedTask[] = [];
	let taskId = 0;

	// Extract unique categories from features
	const featureCategories = [...new Set(analysis.features.map(f => f.category))];

	// Detect what the PRD actually needs (not hardcoded assumptions)
	const needsFrontend = featureCategories.some(c => ['frontend', 'design', 'mobile', 'ecommerce'].includes(c)) ||
		analysis.projectType === 'webapp' || analysis.projectType === 'saas' || analysis.projectType === 'mobile';
	const needsBackend = featureCategories.some(c => ['backend', 'api', 'database', 'auth', 'realtime'].includes(c)) ||
		analysis.projectType === 'api' || analysis.projectType === 'saas';
	const needsAuth = featureCategories.includes('auth') || analysis.projectType === 'saas';
	const needsDatabase = featureCategories.some(c => ['database', 'ecommerce', 'analytics', 'community'].includes(c)) ||
		analysis.techHints.some(t => ['postgres', 'mysql', 'mongodb', 'supabase', 'firebase'].includes(t));
	const needsDeployment = featureCategories.includes('deployment') ||
		analysis.techHints.some(t => ['docker', 'kubernetes', 'vercel', 'aws', 'gcp', 'azure'].includes(t));
	const needsTesting = featureCategories.includes('testing') ||
		analysis.techHints.some(t => ['jest', 'vitest', 'cypress', 'playwright'].includes(t));

	// Track the last task ID for dependencies
	let lastInfraTaskId = 'task-0';

	// Phase 1: Foundation (only if needed)
	// Setup task - only if it's a new project with defined stack
	if (analysis.suggestedStack.frontend?.length || analysis.suggestedStack.backend?.length) {
		const stackDesc = [
			analysis.suggestedStack.frontend?.join(', '),
			analysis.suggestedStack.backend?.join(', ')
		].filter(Boolean).join(' + ');

		tasks.push({
			id: `task-${taskId++}`,
			title: 'Project Setup',
			description: `Initialize ${analysis.projectName} with ${stackDesc || 'chosen stack'}`,
			skillMatch: findBestSkillMatch('project-scaffolding', availableSkills),
			category: 'setup',
			phase: 1,
			dependsOn: []
		});
		lastInfraTaskId = `task-${taskId - 1}`;
	}

	// Design System - only if frontend is needed
	if (needsFrontend) {
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Design System',
			description: 'Create design tokens, color palette, and base UI components',
			skillMatch: findBestSkillMatch('design-system', availableSkills),
			category: 'design',
			phase: 1,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});
		lastInfraTaskId = `task-${taskId - 1}`;
	}

	// Phase 2: Core Infrastructure (conditional based on PRD)
	// Auth - only if explicitly needed
	if (needsAuth) {
		const authStack = analysis.suggestedStack.auth?.join(', ') || 'authentication solution';
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Authentication System',
			description: `Implement user authentication with ${authStack}`,
			skillMatch: findBestSkillMatch('authentication', availableSkills),
			category: 'auth',
			phase: 2,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});
	}

	// Database - only if data storage is needed
	if (needsDatabase) {
		const dbStack = analysis.suggestedStack.database?.join(', ') || 'database';
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Database Schema',
			description: `Design and implement ${dbStack} schema for all entities`,
			skillMatch: findBestSkillMatch('database', availableSkills),
			category: 'database',
			phase: 2,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});
	}

	// API Layer - only if backend is needed
	if (needsBackend) {
		const apiDeps = tasks.filter(t => t.category === 'database').map(t => t.id);
		tasks.push({
			id: `task-${taskId++}`,
			title: 'API Layer',
			description: 'Create REST/GraphQL API endpoints for all features',
			skillMatch: findBestSkillMatch('api-design', availableSkills),
			category: 'backend',
			phase: 2,
			dependsOn: apiDeps.length > 0 ? apiDeps : (tasks.length > 0 ? [lastInfraTaskId] : [])
		});
	}

	// Update lastInfraTaskId to the last infrastructure task
	if (tasks.length > 0) {
		lastInfraTaskId = tasks[tasks.length - 1].id;
	}

	// Phase 3: ALL Feature Implementation (no artificial limits!)
	// Sort features: must-have first, then should-have, then nice-to-have
	const sortedFeatures = [...analysis.features].sort((a, b) => {
		const priorityOrder = { 'must-have': 0, 'should-have': 1, 'nice-to-have': 2 };
		return priorityOrder[a.priority] - priorityOrder[b.priority];
	});

	// Track dependencies within feature phases for parallel execution where possible
	const featureTaskIds: string[] = [];

	// Create tasks for ALL features (no slice limit!)
	for (const feature of sortedFeatures) {
		// Find best skill match using H70 keywords
		const categorySkills = CATEGORY_TO_SKILLS[feature.category] || [];
		let skillMatch = null;

		// Try category skills first
		for (const skillId of categorySkills) {
			skillMatch = findBestSkillMatch(skillId, availableSkills);
			if (skillMatch) break;
		}

		// Fallback to feature name matching
		if (!skillMatch) {
			skillMatch = findBestSkillMatch(feature.name, availableSkills);
		}

		// Determine dependencies - features depend on infrastructure
		const featureDeps = tasks.length > 0 ? [lastInfraTaskId] : [];

		tasks.push({
			id: `task-${taskId++}`,
			title: feature.name,
			description: feature.description,
			skillMatch,
			category: feature.category,
			phase: 3,
			dependsOn: featureDeps
		});

		featureTaskIds.push(`task-${taskId - 1}`);
	}

	// Phase 4: Quality & Deployment (only if PRD mentions or complex project)
	const isComplexProject = analysis.features.length > 5 || analysis.projectType === 'saas';

	// Testing - if mentioned or complex project
	if (needsTesting || isComplexProject) {
		const lastFeatureId = featureTaskIds.length > 0 ? featureTaskIds[featureTaskIds.length - 1] : lastInfraTaskId;
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Testing Suite',
			description: 'Write unit, integration, and e2e tests for implemented features',
			skillMatch: findBestSkillMatch('testing', availableSkills),
			category: 'testing',
			phase: 4,
			dependsOn: [lastFeatureId]
		});
	}

	// Deployment - if mentioned in PRD or has deployment hints
	if (needsDeployment || isComplexProject) {
		const deployDep = tasks.length > 0 ? tasks[tasks.length - 1].id : 'task-0';
		const deploymentStack = analysis.suggestedStack.deployment?.join(', ') || 'production environment';

		tasks.push({
			id: `task-${taskId++}`,
			title: 'Deployment Setup',
			description: `Configure CI/CD and deploy to ${deploymentStack}`,
			skillMatch: findBestSkillMatch('deployment', availableSkills),
			category: 'deployment',
			phase: 4,
			dependsOn: [deployDep]
		});
	}

	// If no tasks were generated (empty/minimal PRD), create a generic task
	if (tasks.length === 0) {
		tasks.push({
			id: 'task-0',
			title: analysis.projectName || 'Implementation',
			description: 'Implement the project requirements',
			skillMatch: findBestSkillMatch('development', availableSkills),
			category: 'general',
			phase: 1,
			dependsOn: []
		});
	}

	return tasks;
}

/**
 * Find the best matching skill from available skills
 * Uses H70 keyword mappings (391 keywords) for comprehensive matching
 */
function findBestSkillMatch(searchTerm: string | undefined, availableSkills: Skill[]): string | null {
	if (!searchTerm || !availableSkills || availableSkills.length === 0) return null;

	const lowerSearch = searchTerm.toLowerCase();
	const availableIds = new Set(availableSkills.map(s => s.id));

	// PRIMARY: Check H70 keyword mappings first (391 keywords)
	// Try exact keyword match
	const h70Skills = KEYWORD_TO_SKILLS[lowerSearch];
	if (h70Skills) {
		for (const skillId of h70Skills) {
			if (availableIds.has(skillId)) {
				return skillId;
			}
		}
	}

	// Try partial H70 keyword match (search term contains keyword)
	for (const [keyword, skills] of Object.entries(KEYWORD_TO_SKILLS)) {
		if (lowerSearch.includes(keyword) || keyword.includes(lowerSearch)) {
			for (const skillId of skills) {
				if (availableIds.has(skillId)) {
					return skillId;
				}
			}
		}
	}

	// FALLBACK: Try exact ID match
	const exactMatch = availableSkills.find(s => s.id?.toLowerCase() === lowerSearch);
	if (exactMatch) return exactMatch.id;

	// Try partial ID match
	const partialMatch = availableSkills.find(s =>
		s.id?.toLowerCase().includes(lowerSearch) ||
		lowerSearch.includes(s.id?.toLowerCase() || '')
	);
	if (partialMatch) return partialMatch.id;

	// Try name match
	const nameMatch = availableSkills.find(s =>
		s.name?.toLowerCase().includes(lowerSearch) ||
		lowerSearch.includes(s.name?.toLowerCase() || '')
	);
	if (nameMatch) return nameMatch.id;

	// Try tag match - filter out undefined tags
	const tagMatch = availableSkills.find(s =>
		s.tags?.filter(Boolean).some(tag => tag.toLowerCase().includes(lowerSearch))
	);
	if (tagMatch) return tagMatch.id;

	return null;
}

/**
 * Convert generated tasks to workflow format for canvas
 */
export function tasksToWorkflow(
	tasks: GeneratedTask[],
	availableSkills: Skill[]
): { nodes: { skill: Skill; position: { x: number; y: number } }[]; connections: { sourceIndex: number; targetIndex: number }[] } {
	const nodes: { skill: Skill; position: { x: number; y: number } }[] = [];
	const connections: { sourceIndex: number; targetIndex: number }[] = [];
	const taskIndexMap = new Map<string, number>();

	// Group tasks by phase for positioning
	const tasksByPhase = new Map<number, GeneratedTask[]>();
	for (const task of tasks) {
		if (!tasksByPhase.has(task.phase)) {
			tasksByPhase.set(task.phase, []);
		}
		tasksByPhase.get(task.phase)!.push(task);
	}

	// Position constants
	const START_X = 100;
	const START_Y = 100;
	const NODE_WIDTH = 220;
	const NODE_HEIGHT = 80;
	const GAP_X = 100;
	const GAP_Y = 50;

	let nodeIndex = 0;
	const phases = [...tasksByPhase.keys()].sort();

	for (const phase of phases) {
		const phaseTasks = tasksByPhase.get(phase)!;
		const phaseX = START_X + (phase - 1) * (NODE_WIDTH + GAP_X);

		for (let i = 0; i < phaseTasks.length; i++) {
			const task = phaseTasks[i];
			const phaseY = START_Y + i * (NODE_HEIGHT + GAP_Y);

			// Find or create skill
			let skill: Skill;
			if (task.skillMatch) {
				const foundSkill = availableSkills.find(s => s.id === task.skillMatch);
				skill = foundSkill || createPlaceholderSkill(task);
			} else {
				skill = createPlaceholderSkill(task);
			}

			taskIndexMap.set(task.id, nodeIndex);
			nodes.push({
				skill,
				position: { x: phaseX, y: phaseY }
			});
			nodeIndex++;
		}
	}

	// Create connections based on dependencies
	for (const task of tasks) {
		const targetIndex = taskIndexMap.get(task.id);
		if (targetIndex === undefined) continue;

		for (const depId of task.dependsOn) {
			const sourceIndex = taskIndexMap.get(depId);
			if (sourceIndex !== undefined) {
				connections.push({ sourceIndex, targetIndex });
			}
		}
	}

	return { nodes, connections };
}

/**
 * Create a placeholder skill for tasks without matches
 */
function createPlaceholderSkill(task: GeneratedTask): Skill {
	const category = task.category || 'development';
	return {
		id: `generated-${task.id}`,
		name: task.title || 'Untitled Task',
		description: task.description || '',
		category: category as any,
		tier: 'free',
		tags: [category].filter(Boolean),
		triggers: []
	};
}
