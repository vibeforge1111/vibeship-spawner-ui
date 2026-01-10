/**
 * PRD Analyzer
 *
 * Analyzes a Product Requirements Document and automatically generates
 * implementation tasks that can be converted to canvas workflow nodes.
 *
 * SEMANTIC MATCHING: Uses TF-IDF-like scoring to identify the most relevant
 * features and skills. Different PRDs generate different workflows.
 *
 * LIMITS: Max 25 feature tasks to keep workflows manageable.
 */

import type { Skill, SkillCategory } from '$lib/stores/skills.svelte';
import { KEYWORD_TO_SKILLS } from '$lib/services/h70-skill-matcher';

// Valid skill categories for type validation
const VALID_CATEGORIES: SkillCategory[] = [
	'development', 'frameworks', 'integrations', 'ai-ml', 'agents',
	'data', 'design', 'marketing', 'strategy', 'enterprise',
	'finance', 'legal', 'science', 'startup'
];

function isValidCategory(cat: string): cat is SkillCategory {
	return VALID_CATEGORIES.includes(cat as SkillCategory);
}

// Maximum tasks to generate (infrastructure + features + deployment)
const MAX_FEATURE_TASKS = 20;
const MAX_TOTAL_TASKS = 30;

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
 * Extract features from PRD content with SEMANTIC SCORING
 *
 * SELECTIVE EXTRACTION: Focuses on explicit feature definitions, not every sentence.
 * Uses relevance scoring to identify the most important features.
 *
 * Sources (in priority order):
 * 1. Explicit feature lists (bulleted/numbered in features section)
 * 2. User stories ("As a user, I want...")
 * 3. Category detection from keywords (consolidated, not per-keyword)
 */
function extractFeatures(content: string): ExtractedFeature[] {
	const rawFeatures: Array<ExtractedFeature & { relevanceScore: number }> = [];
	const seenNormalized = new Set<string>(); // Normalized names for dedup
	const lines = content.split('\n');
	const lowerContent = content.toLowerCase();

	let inFeaturesSection = false;
	let sectionBonus = 0; // Features in explicit sections get higher scores

	for (const line of lines) {
		const lowerLine = line.toLowerCase();
		const trimmedLine = line.trim();

		// Detect features/requirements section - items here are more important
		if (/^#{1,3}\s*(features?|requirements?|user\s*stor|functional\s*spec|capabilities)/i.test(trimmedLine)) {
			inFeaturesSection = true;
			sectionBonus = 0.3; // 30% bonus for features in explicit sections
			continue;
		}

		// Detect end of features section
		if (inFeaturesSection && /^#{1,2}\s+(?!feature|requirement)/i.test(trimmedLine)) {
			inFeaturesSection = false;
			sectionBonus = 0;
		}

		// Method 1: Extract bulleted/numbered features (most explicit)
		const bulletMatch = trimmedLine.match(/^[-*•]\s*\*?\*?(.+?)\*?\*?$/);
		const numberedMatch = trimmedLine.match(/^\d+[.)]\s*\*?\*?(.+?)\*?\*?$/);
		const featureMatch = bulletMatch || numberedMatch;

		if (featureMatch) {
			const rawName = featureMatch[1].trim();
			const colonSplit = rawName.split(/[:\-–]/);
			const name = colonSplit[0].trim().replace(/\*\*/g, '');
			const description = colonSplit.slice(1).join(':').trim() || name;
			const normalized = normalizeFeatureName(name);

			// Skip very short or generic items
			if (name.length > 3 && name.length < 100 && !seenNormalized.has(normalized) && !isGenericItem(name)) {
				seenNormalized.add(normalized);
				const feature = createFeatureWithScore(name, description, lowerLine, sectionBonus);
				rawFeatures.push(feature);
			}
		}

		// Method 2: User stories (explicit intent)
		const userStoryMatch = trimmedLine.match(/as a .*?(?:i want|i need|i should be able to)\s+(.+?)(?:so that|$)/i);
		if (userStoryMatch) {
			const name = userStoryMatch[1].trim().replace(/[.,]$/, '');
			const normalized = normalizeFeatureName(name);

			if (name.length > 5 && name.length < 100 && !seenNormalized.has(normalized)) {
				seenNormalized.add(normalized);
				const feature = createFeatureWithScore(name, trimmedLine, lowerLine, 0.2); // User stories get bonus
				rawFeatures.push(feature);
			}
		}
	}

	// Method 3: Category-based feature detection (consolidate by category)
	// Only if we found few explicit features
	if (rawFeatures.length < 5) {
		const detectedCategories = detectCategoriesFromContent(lowerContent);

		for (const { category, score, keywords } of detectedCategories) {
			const featureName = `${capitalize(category)} System`;
			const normalized = normalizeFeatureName(featureName);

			if (!seenNormalized.has(normalized) && score >= 0.3) {
				seenNormalized.add(normalized);
				rawFeatures.push({
					name: featureName,
					description: `Implement ${category} functionality (detected: ${keywords.slice(0, 3).join(', ')})`,
					priority: score >= 0.6 ? 'must-have' : 'should-have',
					category,
					relevanceScore: score
				});
			}
		}
	}

	// Sort by relevance score and limit
	rawFeatures.sort((a, b) => b.relevanceScore - a.relevanceScore);

	// Consolidate similar features by category
	const consolidated = consolidateFeatures(rawFeatures);

	// Return top features within limit
	return consolidated.slice(0, MAX_FEATURE_TASKS).map(f => ({
		name: f.name,
		description: f.description,
		priority: f.priority,
		category: f.category
	}));
}

/**
 * Normalize feature name for deduplication
 */
function normalizeFeatureName(name: string): string {
	return name.toLowerCase()
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Check if a bullet item is too generic to be a feature
 */
function isGenericItem(name: string): boolean {
	const genericPatterns = [
		/^(the|a|an|this|that|it)\s/i,
		/^(yes|no|true|false|ok|okay)$/i,
		/^(step|phase|stage|part)\s*\d/i,
		/^(note|warning|important|todo|fixme)/i,
		/^[a-z]$/i, // Single letter
		/^\d+$/,    // Just numbers
	];
	return genericPatterns.some(p => p.test(name));
}

/**
 * Create feature with semantic relevance score
 */
function createFeatureWithScore(
	name: string,
	description: string,
	contextLine: string,
	bonus: number = 0
): ExtractedFeature & { relevanceScore: number } {
	const feature = createFeature(name, description, contextLine);

	// Calculate relevance score based on:
	// 1. Category specificity (non-general categories score higher)
	// 2. Keyword density in name/description
	// 3. Section bonus (explicit feature sections)
	// 4. Priority (must-have > should-have > nice-to-have)

	let score = 0.5; // Base score

	// Category bonus
	if (feature.category !== 'general') {
		score += 0.2;
	}

	// Priority bonus
	if (feature.priority === 'must-have') {
		score += 0.2;
	} else if (feature.priority === 'nice-to-have') {
		score -= 0.1;
	}

	// Keyword density bonus
	const categoryKeywords = FEATURE_CATEGORIES[feature.category] || [];
	const nameWords = name.toLowerCase().split(/\s+/);
	const keywordMatches = nameWords.filter(w => categoryKeywords.some(kw => kw.includes(w) || w.includes(kw)));
	score += Math.min(0.2, keywordMatches.length * 0.05);

	// Apply section bonus
	score += bonus;

	return { ...feature, relevanceScore: Math.min(1, score) };
}

/**
 * Detect categories from content using TF-IDF-like scoring
 */
function detectCategoriesFromContent(content: string): Array<{ category: string; score: number; keywords: string[] }> {
	const results: Array<{ category: string; score: number; keywords: string[] }> = [];
	const totalWords = content.split(/\s+/).length;

	for (const [category, keywords] of Object.entries(FEATURE_CATEGORIES)) {
		const matchedKeywords: string[] = [];
		let termFrequency = 0;

		for (const keyword of keywords) {
			// Count occurrences (simple TF)
			const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
			const matches = content.match(regex);
			if (matches) {
				matchedKeywords.push(keyword);
				termFrequency += matches.length;
			}
		}

		if (matchedKeywords.length > 0) {
			// Score based on:
			// - Number of unique keywords matched (diversity)
			// - Term frequency relative to document size
			// - Inverse document frequency approximation (rarer categories score higher)
			const diversity = matchedKeywords.length / keywords.length;
			const frequency = Math.min(1, termFrequency / (totalWords * 0.01)); // Normalize
			const idf = 1 / Math.log(keywords.length + 1); // Smaller keyword sets are more specific

			const score = (diversity * 0.5) + (frequency * 0.3) + (idf * 0.2);

			results.push({ category, score: Math.min(1, score), keywords: matchedKeywords });
		}
	}

	// Sort by score descending
	return results.sort((a, b) => b.score - a.score);
}

/**
 * Consolidate similar features by category
 */
function consolidateFeatures(
	features: Array<ExtractedFeature & { relevanceScore: number }>
): Array<ExtractedFeature & { relevanceScore: number }> {
	// Group by category
	const byCategory = new Map<string, Array<ExtractedFeature & { relevanceScore: number }>>();

	for (const feature of features) {
		const existing = byCategory.get(feature.category) || [];
		existing.push(feature);
		byCategory.set(feature.category, existing);
	}

	const consolidated: Array<ExtractedFeature & { relevanceScore: number }> = [];

	for (const [category, categoryFeatures] of byCategory) {
		// If category has many features, keep top 3 and merge rest into one
		if (categoryFeatures.length > 3) {
			// Keep top 3 by score
			categoryFeatures.sort((a, b) => b.relevanceScore - a.relevanceScore);
			consolidated.push(...categoryFeatures.slice(0, 3));

			// Merge rest into consolidated feature
			const remaining = categoryFeatures.slice(3);
			if (remaining.length > 0) {
				const mergedNames = remaining.map(f => f.name).slice(0, 3).join(', ');
				consolidated.push({
					name: `Additional ${capitalize(category)} Features`,
					description: `Includes: ${mergedNames}${remaining.length > 3 ? ` and ${remaining.length - 3} more` : ''}`,
					priority: 'should-have',
					category,
					relevanceScore: Math.max(...remaining.map(f => f.relevanceScore)) * 0.8
				});
			}
		} else {
			consolidated.push(...categoryFeatures);
		}
	}

	// Re-sort by score
	return consolidated.sort((a, b) => b.relevanceScore - a.relevanceScore);
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
 * SEMANTIC GENERATION: Tasks are created based on actual PRD content with
 * relevance scoring. Different PRDs generate different workflows.
 *
 * LIMITS: Max 30 total tasks to keep workflows manageable.
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
	if (analysis.suggestedStack.frontend?.length || analysis.suggestedStack.backend?.length) {
		const stackDesc = [
			analysis.suggestedStack.frontend?.join(', '),
			analysis.suggestedStack.backend?.join(', ')
		].filter(Boolean).join(' + ');

		tasks.push({
			id: `task-${taskId++}`,
			title: 'Project Setup',
			description: `Initialize ${analysis.projectName} with ${stackDesc || 'chosen stack'}`,
			skillMatch: findBestSkillMatchWithScore('project-scaffolding', availableSkills),
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
			skillMatch: findBestSkillMatchWithScore('design-system', availableSkills),
			category: 'design',
			phase: 1,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});
		lastInfraTaskId = `task-${taskId - 1}`;
	}

	// Phase 2: Core Infrastructure (conditional)
	if (needsAuth) {
		const authStack = analysis.suggestedStack.auth?.join(', ') || 'authentication solution';
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Authentication System',
			description: `Implement user authentication with ${authStack}`,
			skillMatch: findBestSkillMatchWithScore('authentication', availableSkills),
			category: 'auth',
			phase: 2,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});
	}

	if (needsDatabase) {
		const dbStack = analysis.suggestedStack.database?.join(', ') || 'database';
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Database Schema',
			description: `Design and implement ${dbStack} schema for all entities`,
			skillMatch: findBestSkillMatchWithScore('database', availableSkills),
			category: 'database',
			phase: 2,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});
	}

	if (needsBackend) {
		const apiDeps = tasks.filter(t => t.category === 'database').map(t => t.id);
		tasks.push({
			id: `task-${taskId++}`,
			title: 'API Layer',
			description: 'Create REST/GraphQL API endpoints for all features',
			skillMatch: findBestSkillMatchWithScore('api-design', availableSkills),
			category: 'backend',
			phase: 2,
			dependsOn: apiDeps.length > 0 ? apiDeps : (tasks.length > 0 ? [lastInfraTaskId] : [])
		});
	}

	// Update lastInfraTaskId
	if (tasks.length > 0) {
		lastInfraTaskId = tasks[tasks.length - 1].id;
	}

	// Calculate remaining slots for feature tasks
	const infraTasks = tasks.length;
	const reservedSlots = 2; // Testing + Deployment
	const availableFeatureSlots = Math.max(5, MAX_TOTAL_TASKS - infraTasks - reservedSlots);

	// Phase 3: Feature Implementation (with limit)
	// Features are already sorted and consolidated by extractFeatures
	const featuresToAdd = analysis.features.slice(0, availableFeatureSlots);
	const featureTaskIds: string[] = [];

	for (const feature of featuresToAdd) {
		// Find best skill match using semantic scoring
		const skillMatch = findBestSkillForFeature(feature, availableSkills);

		tasks.push({
			id: `task-${taskId++}`,
			title: feature.name,
			description: feature.description,
			skillMatch,
			category: feature.category,
			phase: 3,
			dependsOn: tasks.length > 0 ? [lastInfraTaskId] : []
		});

		featureTaskIds.push(`task-${taskId - 1}`);
	}

	// Phase 4: Quality & Deployment (only if complex enough)
	const isComplexProject = analysis.features.length > 3 || analysis.projectType === 'saas';

	if ((needsTesting || isComplexProject) && tasks.length < MAX_TOTAL_TASKS) {
		const lastFeatureId = featureTaskIds.length > 0 ? featureTaskIds[featureTaskIds.length - 1] : lastInfraTaskId;
		tasks.push({
			id: `task-${taskId++}`,
			title: 'Testing Suite',
			description: 'Write unit, integration, and e2e tests for implemented features',
			skillMatch: findBestSkillMatchWithScore('testing', availableSkills),
			category: 'testing',
			phase: 4,
			dependsOn: [lastFeatureId]
		});
	}

	if ((needsDeployment || isComplexProject) && tasks.length < MAX_TOTAL_TASKS) {
		const deployDep = tasks.length > 0 ? tasks[tasks.length - 1].id : 'task-0';
		const deploymentStack = analysis.suggestedStack.deployment?.join(', ') || 'production environment';

		tasks.push({
			id: `task-${taskId++}`,
			title: 'Deployment Setup',
			description: `Configure CI/CD and deploy to ${deploymentStack}`,
			skillMatch: findBestSkillMatchWithScore('deployment', availableSkills),
			category: 'deployment',
			phase: 4,
			dependsOn: [deployDep]
		});
	}

	// Fallback for empty PRDs
	if (tasks.length === 0) {
		tasks.push({
			id: 'task-0',
			title: analysis.projectName || 'Implementation',
			description: 'Implement the project requirements',
			skillMatch: findBestSkillMatchWithScore('development', availableSkills),
			category: 'general',
			phase: 1,
			dependsOn: []
		});
	}

	return tasks;
}

/**
 * Find best skill for a feature using semantic scoring
 */
function findBestSkillForFeature(feature: ExtractedFeature, availableSkills: Skill[]): string | null {
	// Get category skills
	const categorySkills = CATEGORY_TO_SKILLS[feature.category] || [];

	// Try category skills with scoring
	let bestMatch: { skillId: string; score: number } | null = null;

	for (const skillId of categorySkills) {
		const skill = availableSkills.find(s => s.id === skillId);
		if (skill) {
			const score = calculateSkillRelevance(feature, skill);
			if (!bestMatch || score > bestMatch.score) {
				bestMatch = { skillId, score };
			}
		}
	}

	// If good match found, return it
	if (bestMatch && bestMatch.score > 0.3) {
		return bestMatch.skillId;
	}

	// Fallback to name-based matching
	return findBestSkillMatchWithScore(feature.name, availableSkills);
}

/**
 * Calculate semantic relevance between feature and skill
 */
function calculateSkillRelevance(feature: ExtractedFeature, skill: Skill): number {
	let score = 0.5; // Base score for category match

	const featureWords = new Set(feature.name.toLowerCase().split(/\s+/));
	const descWords = new Set((feature.description || '').toLowerCase().split(/\s+/));
	const skillWords = new Set([
		...(skill.name || '').toLowerCase().split(/\s+/),
		...(skill.description || '').toLowerCase().split(/\s+/),
		...(skill.tags || []).map(t => t?.toLowerCase()).filter(Boolean)
	]);

	// Word overlap bonus
	let overlapCount = 0;
	for (const word of featureWords) {
		if (word.length > 2 && skillWords.has(word)) overlapCount++;
	}
	for (const word of descWords) {
		if (word.length > 3 && skillWords.has(word)) overlapCount++;
	}
	score += Math.min(0.3, overlapCount * 0.05);

	// Category match bonus
	if (skill.category === feature.category) {
		score += 0.2;
	}

	return Math.min(1, score);
}

/**
 * Find best skill match using semantic scoring (improved version)
 */
function findBestSkillMatchWithScore(searchTerm: string | undefined, availableSkills: Skill[]): string | null {
	if (!searchTerm || !availableSkills || availableSkills.length === 0) return null;

	const lowerSearch = searchTerm.toLowerCase();
	const searchWords = new Set(lowerSearch.split(/\s+/).filter(w => w.length > 2));
	const availableIds = new Set(availableSkills.map(s => s.id));

	// Score all H70 keyword matches
	const scoredMatches: Array<{ skillId: string; score: number }> = [];

	// Check H70 keyword mappings with scoring
	for (const [keyword, skills] of Object.entries(KEYWORD_TO_SKILLS)) {
		// Calculate keyword relevance to search term
		const keywordLower = keyword.toLowerCase();
		let relevance = 0;

		if (lowerSearch === keywordLower) {
			relevance = 1.0; // Exact match
		} else if (lowerSearch.includes(keywordLower)) {
			relevance = 0.7; // Search contains keyword
		} else if (keywordLower.includes(lowerSearch)) {
			relevance = 0.5; // Keyword contains search
		} else {
			// Word overlap
			const keywordWords = new Set(keywordLower.split(/\s+/));
			let overlap = 0;
			for (const word of searchWords) {
				if (keywordWords.has(word)) overlap++;
			}
			relevance = overlap > 0 ? 0.3 * (overlap / Math.max(searchWords.size, keywordWords.size)) : 0;
		}

		if (relevance > 0.1) {
			for (let i = 0; i < skills.length; i++) {
				const skillId = skills[i];
				if (availableIds.has(skillId)) {
					// Earlier in list = higher priority
					const positionBonus = (skills.length - i) / skills.length * 0.2;
					scoredMatches.push({ skillId, score: relevance + positionBonus });
				}
			}
		}
	}

	// Sort by score and return best match
	if (scoredMatches.length > 0) {
		scoredMatches.sort((a, b) => b.score - a.score);
		return scoredMatches[0].skillId;
	}

	// Fallback to simple matching
	return findBestSkillMatch(searchTerm, availableSkills);
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
	const rawCategory = task.category || 'development';
	const category: SkillCategory = isValidCategory(rawCategory) ? rawCategory : 'development';
	return {
		id: `generated-${task.id}`,
		name: task.title || 'Untitled Task',
		description: task.description || '',
		category,
		tier: 'free',
		tags: [category].filter(Boolean),
		triggers: []
	};
}
