/**
 * Domain Detector Service
 *
 * Intelligently detects the project domain from PRD content.
 * Uses keyword patterns and semantic indicators to classify projects.
 */

export type ProjectDomain =
	| 'game'
	| 'saas'
	| 'ecommerce'
	| 'mobile'
	| 'ai'
	| 'web3'
	| 'content'
	| 'devtool'
	| 'general';

export interface DomainDetectionResult {
	primary: ProjectDomain;
	secondary: ProjectDomain | null;
	confidence: number;
	signals: string[];
}

/**
 * Domain detection patterns
 * Each domain has keywords, phrases, and context indicators
 */
const DOMAIN_PATTERNS: Record<ProjectDomain, {
	keywords: string[];
	phrases: string[];
	weight: number;
}> = {
	game: {
		keywords: [
			'game', 'player', 'level', 'score', 'enemy', 'boss', 'weapon', 'inventory',
			'character', 'npc', 'spawn', 'multiplayer', 'pvp', 'pve', 'lobby', 'match',
			'leaderboard', 'achievement', 'quest', 'mission', 'gameplay', 'controller',
			'sprite', 'animation', 'collision', 'physics', 'hitbox', 'respawn', 'health',
			'mana', 'stamina', 'xp', 'experience', 'loot', 'drop', 'craft', 'build',
			'survival', 'roguelike', 'platformer', 'shooter', 'rpg', 'mmorpg', 'fps',
			'rts', 'moba', 'battle royale', 'idle', 'clicker', 'puzzle', 'card game',
			'board game', 'turn-based', 'real-time', 'co-op', 'coop', 'singleplayer',
			'unity', 'unreal', 'godot', 'phaser', 'pixijs', 'threejs', 'babylon',
			'gamedev', 'game dev', 'game design', 'game jam'
		],
		phrases: [
			'play the game', 'start game', 'game over', 'high score', 'new game',
			'save game', 'load game', 'game state', 'game loop', 'game engine',
			'player vs', 'enemy ai', 'behavior tree', 'state machine', 'pathfinding'
		],
		weight: 1.5 // Games get a boost because they're often misclassified
	},
	saas: {
		keywords: [
			'subscription', 'billing', 'pricing', 'tier', 'plan', 'trial', 'freemium',
			'enterprise', 'team', 'workspace', 'organization', 'admin', 'dashboard',
			'analytics', 'metrics', 'onboarding', 'invite', 'seat', 'license',
			'multi-tenant', 'tenant', 'white-label', 'api key', 'rate limit', 'quota',
			'usage', 'webhook', 'integration', 'oauth', 'sso', 'rbac', 'permissions'
		],
		phrases: [
			'sign up', 'log in', 'forgot password', 'upgrade plan', 'cancel subscription',
			'team members', 'user management', 'admin panel', 'api access'
		],
		weight: 1.0
	},
	ecommerce: {
		keywords: [
			'product', 'cart', 'checkout', 'order', 'shipping', 'inventory', 'sku',
			'catalog', 'category', 'variant', 'price', 'discount', 'coupon', 'promo',
			'wishlist', 'review', 'rating', 'shop', 'store', 'marketplace', 'vendor',
			'seller', 'buyer', 'payment', 'refund', 'return', 'tracking', 'fulfillment'
		],
		phrases: [
			'add to cart', 'buy now', 'place order', 'track order', 'product page',
			'shopping cart', 'payment method', 'shipping address'
		],
		weight: 1.0
	},
	mobile: {
		keywords: [
			'ios', 'android', 'mobile', 'app', 'native', 'react native', 'flutter',
			'expo', 'swift', 'kotlin', 'push notification', 'deep link', 'app store',
			'play store', 'offline', 'sync', 'gesture', 'swipe', 'tap', 'touch'
		],
		phrases: [
			'mobile app', 'native app', 'cross-platform', 'app download', 'install app'
		],
		weight: 1.0
	},
	ai: {
		keywords: [
			'ai', 'ml', 'llm', 'gpt', 'claude', 'openai', 'anthropic', 'model',
			'prompt', 'embedding', 'vector', 'rag', 'agent', 'chatbot', 'assistant',
			'generate', 'inference', 'fine-tune', 'training', 'neural', 'transformer'
		],
		phrases: [
			'ai assistant', 'language model', 'machine learning', 'natural language',
			'text generation', 'image generation', 'ai agent'
		],
		weight: 1.0
	},
	web3: {
		keywords: [
			'blockchain', 'crypto', 'token', 'nft', 'wallet', 'smart contract',
			'solidity', 'ethereum', 'solana', 'polygon', 'defi', 'dao', 'mint',
			'stake', 'yield', 'liquidity', 'swap', 'bridge', 'gas', 'web3'
		],
		phrases: [
			'connect wallet', 'mint nft', 'smart contract', 'on-chain', 'off-chain'
		],
		weight: 1.0
	},
	content: {
		keywords: [
			'blog', 'post', 'article', 'cms', 'content', 'editor', 'publish',
			'draft', 'media', 'image', 'video', 'podcast', 'newsletter', 'subscriber',
			'author', 'comment', 'tag', 'category', 'seo', 'social'
		],
		phrases: [
			'content management', 'blog post', 'publish content', 'media library'
		],
		weight: 1.0
	},
	devtool: {
		keywords: [
			'cli', 'sdk', 'api', 'developer', 'debug', 'log', 'monitor', 'trace',
			'plugin', 'extension', 'ide', 'code', 'git', 'ci', 'cd', 'deploy',
			'build', 'test', 'lint', 'format', 'package', 'module', 'library'
		],
		phrases: [
			'developer tool', 'command line', 'api client', 'code editor'
		],
		weight: 1.0
	},
	general: {
		keywords: [],
		phrases: [],
		weight: 0.5 // Fallback domain
	}
};

/**
 * Detect the primary domain from PRD content
 */
export function detectDomain(prdContent: string): DomainDetectionResult {
	const content = prdContent.toLowerCase();
	const scores: Record<ProjectDomain, { score: number; signals: string[] }> = {
		game: { score: 0, signals: [] },
		saas: { score: 0, signals: [] },
		ecommerce: { score: 0, signals: [] },
		mobile: { score: 0, signals: [] },
		ai: { score: 0, signals: [] },
		web3: { score: 0, signals: [] },
		content: { score: 0, signals: [] },
		devtool: { score: 0, signals: [] },
		general: { score: 0, signals: [] }
	};

	// Score each domain
	for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS) as [ProjectDomain, typeof DOMAIN_PATTERNS[ProjectDomain]][]) {
		// Check keywords
		for (const keyword of patterns.keywords) {
			const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
			const matches = content.match(regex);
			if (matches) {
				scores[domain].score += matches.length * patterns.weight;
				if (!scores[domain].signals.includes(keyword)) {
					scores[domain].signals.push(keyword);
				}
			}
		}

		// Check phrases (worth more)
		for (const phrase of patterns.phrases) {
			if (content.includes(phrase)) {
				scores[domain].score += 3 * patterns.weight;
				scores[domain].signals.push(`"${phrase}"`);
			}
		}
	}

	// Find primary and secondary domains
	const sortedDomains = Object.entries(scores)
		.filter(([domain]) => domain !== 'general')
		.sort((a, b) => b[1].score - a[1].score);

	const primary = sortedDomains[0]?.[1].score > 0 ? sortedDomains[0][0] as ProjectDomain : 'general';
	const secondary = sortedDomains[1]?.[1].score > 2 ? sortedDomains[1][0] as ProjectDomain : null;

	// Calculate confidence
	const totalScore = sortedDomains.reduce((sum, [, data]) => sum + data.score, 0);
	const primaryScore = scores[primary].score;
	const confidence = totalScore > 0 ? Math.min(1, primaryScore / Math.max(totalScore * 0.5, 5)) : 0;

	return {
		primary,
		secondary,
		confidence,
		signals: scores[primary].signals.slice(0, 10) // Top 10 signals
	};
}

/**
 * Domain-specific skill packs
 * These are cohesive sets of skills that work well together for each domain
 */
export const DOMAIN_SKILL_PACKS: Record<ProjectDomain, {
	core: string[];      // Always include these
	common: string[];    // Include most of the time
	optional: string[];  // Include based on specific features
}> = {
	game: {
		core: [
			'game-development', 'game-design', 'game-design-core',
			'state-management', 'performance-hunter'
		],
		common: [
			'game-ai-behavior', 'game-ai-behavior-trees', 'game-audio',
			'game-ui-design', 'game-networking', 'realtime-engineer',
			'animation-systems', 'threejs-3d-graphics'
		],
		optional: [
			'game-monetization', 'mobile-game-dev', 'ai-game-art-generation',
			'llm-game-development', 'board-game-design', 'card-game-design',
			'prompt-to-game', 'unity-development', 'godot-development'
		]
	},
	saas: {
		core: [
			'nextjs-app-router', 'auth-specialist', 'database-architect',
			'api-designer', 'stripe-integration'
		],
		common: [
			'subscription-billing', 'supabase-backend', 'postgres-wizard',
			'security-hardening', 'analytics', 'testing-automation'
		],
		optional: [
			'multi-tenant-architecture', 'rbac-specialist', 'webhook-architect',
			'email-systems', 'admin-panel', 'vercel-deployment'
		]
	},
	ecommerce: {
		core: [
			'ecommerce-architect', 'stripe-integration', 'database-architect',
			'frontend', 'api-designer'
		],
		common: [
			'inventory-management', 'search-specialist', 'analytics',
			'supabase-backend', 'email-systems', 'seo'
		],
		optional: [
			'recommendation-systems', 'image-optimization', 'cdn-specialist',
			'shipping-integration', 'tax-compliance'
		]
	},
	mobile: {
		core: [
			'react-native-specialist', 'expo', 'mobile-game-dev',
			'state-management', 'api-designer'
		],
		common: [
			'ios-swift-specialist', 'push-notification', 'offline-first',
			'performance-hunter', 'testing-automation'
		],
		optional: [
			'deep-linking', 'app-store-optimization', 'mobile-analytics',
			'gesture-systems', 'native-modules'
		]
	},
	ai: {
		core: [
			'llm-architect', 'prompt-engineer', 'rag-engineer',
			'ai-agents-architect', 'api-designer'
		],
		common: [
			'vector-specialist', 'semantic-search', 'structured-output',
			'streaming-specialist', 'database-architect'
		],
		optional: [
			'fine-tuning-specialist', 'evaluation-engineer', 'guardrails',
			'multi-agent-orchestration', 'llm-security-audit'
		]
	},
	web3: {
		core: [
			'smart-contract-engineer', 'wallet-integration', 'web3-specialist',
			'blockchain-defi', 'frontend'
		],
		common: [
			'nft-engineer', 'defi-architect', 'security-hardening',
			'gas-optimization', 'smart-contract-auditor'
		],
		optional: [
			'dao-architect', 'tokenomics', 'bridge-specialist',
			'indexer-specialist', 'ipfs-integration'
		]
	},
	content: {
		core: [
			'cms-architect', 'content-strategy', 'frontend',
			'database-architect', 'seo'
		],
		common: [
			'editor-specialist', 'media-management', 'search-specialist',
			'newsletter-architect', 'analytics'
		],
		optional: [
			'social-integration', 'comment-systems', 'moderation',
			'cdn-specialist', 'markdown-specialist'
		]
	},
	devtool: {
		core: [
			'cli-architect', 'api-designer', 'typescript-strict',
			'documentation', 'testing-automation'
		],
		common: [
			'sdk-design', 'plugin-architecture', 'git-workflow',
			'ci-cd-pipeline', 'performance-hunter'
		],
		optional: [
			'ide-integration', 'debug-tooling', 'logging-specialist',
			'package-publishing', 'versioning-specialist'
		]
	},
	general: {
		core: [
			'nextjs-app-router', 'frontend', 'database-architect',
			'api-designer', 'auth-specialist'
		],
		common: [
			'supabase-backend', 'tailwind-css', 'typescript-strict',
			'testing-automation', 'vercel-deployment'
		],
		optional: []
	}
};

/**
 * Get recommended skills for a detected domain
 * @param domain - The detected project domain
 * @param maxSkills - Maximum number of skills to return
 * @returns Array of skill IDs
 */
export function getSkillsForDomain(
	domain: ProjectDomain,
	maxSkills: number = 25
): string[] {
	const pack = DOMAIN_SKILL_PACKS[domain];
	const skills: string[] = [...pack.core];

	// Add common skills
	const remainingSlots = maxSkills - skills.length;
	const commonToAdd = Math.min(pack.common.length, Math.floor(remainingSlots * 0.7));
	skills.push(...pack.common.slice(0, commonToAdd));

	// Add optional skills if space remains
	const optionalSlots = maxSkills - skills.length;
	if (optionalSlots > 0 && pack.optional.length > 0) {
		skills.push(...pack.optional.slice(0, optionalSlots));
	}

	return skills.slice(0, maxSkills);
}

/**
 * Get skills for detected domain with feature refinement
 * @param prdContent - The PRD content
 * @param maxSkills - Maximum skills to return
 */
export function detectAndGetSkills(
	prdContent: string,
	maxSkills: number = 25
): {
	domain: DomainDetectionResult;
	skills: string[];
} {
	const domain = detectDomain(prdContent);
	let skills = getSkillsForDomain(domain.primary, maxSkills);

	// If secondary domain detected with good confidence, blend in some skills
	if (domain.secondary && domain.confidence < 0.8) {
		const secondarySkills = DOMAIN_SKILL_PACKS[domain.secondary].core.slice(0, 3);
		// Add secondary skills that aren't already included
		for (const skill of secondarySkills) {
			if (!skills.includes(skill) && skills.length < maxSkills) {
				skills.push(skill);
			}
		}
	}

	return { domain, skills };
}
