import { rankSkillsForText } from './h70-skill-matcher';

export interface SkillRecommendationEvalCase {
	name: string;
	prompt: string;
	mustInclude?: string[];
	anyOf?: string[][];
	mustNotInclude?: string[];
	maxResults?: number;
}

export interface SkillRecommendationEvalResult {
	name: string;
	prompt: string;
	ids: string[];
	pass: boolean;
	score: number;
	labeledPrecisionAtK: number;
	requiredRecall: number;
	anyOfRecall: number;
	mustNotCleanRate: number;
	missingRequired: string[];
	missingAnyOf: string[][];
	unwanted: string[];
	relevantReturned: string[];
}

export const GOLDEN_RECOMMENDATION_CASES: SkillRecommendationEvalCase[] = [
	{
		name: 'RAG chatbot',
		prompt: 'Build a production RAG chatbot with embeddings, vector retrieval, semantic search, citations, and prompt evaluation',
		mustInclude: ['semantic-search', 'llm-architect'],
		anyOf: [['rag-engineer', 'rag-implementation', 'vector-specialist']],
		mustNotInclude: ['nft-engineer', 'streamer-bait-design', 'portfolio-optimization']
	},
	{
		name: 'AI art consistency',
		prompt: 'Create a consistent AI art series with the same character, visual style, image generation, and shot continuity',
		mustInclude: ['art-consistency', 'ai-image-generation', 'ai-video-generation'],
		mustNotInclude: ['rate-limiting', 'digital-product-delivery']
	},
	{
		name: 'Mobile app',
		prompt: 'Build a mobile app with Expo and React Native, native iOS and Android integrations, push notifications, and app store deployment',
		mustInclude: ['expo', 'react-native-specialist', 'ios-swift-specialist', 'android-kotlin-specialist'],
		mustNotInclude: [
			'mobile-development',
			'kubernetes-deployment',
			'mcp-deployment',
			'vercel-deployment',
			'shopify-store-builder',
			'mobile-game-dev'
		]
	},
	{
		name: 'SaaS billing',
		prompt: 'Build a SaaS app with authentication, subscriptions, Stripe billing, dashboard analytics, and onboarding',
		anyOf: [
			['auth-specialist', 'authentication-oauth', 'nextjs-supabase-auth'],
			['stripe-integration', 'subscription-billing'],
			['analytics', 'product-analytics', 'dashboard-design']
		]
	},
	{
		name: 'Multiplayer game',
		prompt: 'Build a multiplayer roguelike game with procedural dungeons, inventory, combat, and online sync',
		mustInclude: ['game-development'],
		anyOf: [
			['game-networking', 'websocket-realtime'],
			['procedural-generation', 'roguelike-dungeon', 'game-design-core']
		]
	},
	{
		name: 'Ecommerce checkout',
		prompt: 'Build an ecommerce checkout with cart, Stripe payments, digital product delivery, email receipts, and analytics',
		mustInclude: ['ecommerce-cart-checkout', 'stripe-integration', 'digital-product-delivery'],
		anyOf: [['resend-email', 'email-deliverability', 'email-marketing']]
	},
	{
		name: 'AI agent tooling',
		prompt: 'Build an AI agent with tool calling, memory, multi-agent orchestration, and MCP server integration',
		mustInclude: ['agent-tool-builder', 'agent-memory-systems'],
		anyOf: [
			['multi-agent-orchestration', 'ai-agents-architect'],
			['mcp-server-development', 'mcp-developer']
		]
	},
	{
		name: 'Realtime chat',
		prompt: 'Build a realtime chat app with websockets, presence indicators, push notifications, and message history',
		mustInclude: ['realtime-chat-systems', 'presence-indicators', 'push-notifications'],
		anyOf: [['websocket-realtime', 'websockets-realtime', 'realtime-engineer']]
	},
	{
		name: 'Devops deployment',
		prompt: 'Build a Kubernetes deployment pipeline with Docker containers, CI/CD, infrastructure as code, and monitoring',
		mustInclude: ['kubernetes', 'docker', 'infrastructure-as-code'],
		anyOf: [['ci-cd-pipeline', 'devops', 'devops-engineer']]
	},
	{
		name: 'Compliance privacy',
		prompt: 'Build a GDPR compliant healthcare app with audit logging, privacy controls, HIPAA compliance, and security hardening',
		mustInclude: ['audit-logging', 'security-hardening', 'compliance-automation'],
		anyOf: [['gdpr-privacy', 'privacy-guardian']]
	},
	{
		name: 'Web3 NFT marketplace',
		prompt: 'Build a Web3 NFT marketplace with wallet login, smart contracts, minting, royalties, and token-gated community',
		mustInclude: ['nft-engineer', 'smart-contract-engineer', 'wallet-integration'],
		anyOf: [['web3-community', 'blockchain-defi']]
	},
	{
		name: 'SEO landing page',
		prompt: 'Build a SEO landing page with copywriting, conversion rate optimization, waitlist capture, and analytics',
		mustInclude: ['seo', 'copywriting', 'conversion-rate-optimization'],
		anyOf: [['landing-page-design', 'waitlist-launch-pages']]
	},
	{
		name: 'Data pipeline',
		prompt: 'Build a data pipeline with ETL, warehouse analytics, dashboards, metrics, and data quality checks',
		mustInclude: ['data-pipeline', 'data-engineer', 'analytics'],
		anyOf: [['observability', 'analytics-architecture']]
	},
	{
		name: 'Browser automation extension',
		prompt: 'Build a browser extension that automates websites with Playwright tests and background scripts',
		mustInclude: ['browser-extension-builder', 'browser-automation', 'playwright-testing']
	},
	{
		name: 'Document AI',
		prompt: 'Build a PDF document AI system with OCR, extraction, RAG over documents, and structured output',
		mustInclude: ['document-ai', 'structured-output'],
		anyOf: [['semantic-search', 'rag-engineer', 'rag-implementation']]
	},
	{
		name: 'Voice AI support',
		prompt: 'Build a voice AI support bot with speech to text, text to speech, Twilio calls, and conversation memory',
		mustInclude: ['voice-ai-development', 'twilio-communications'],
		anyOf: [['voice-agents', 'conversation-memory']]
	},
	{
		name: 'Realtime whiteboard',
		prompt: 'Build a realtime collaborative whiteboard with presence, websocket sync, optimistic updates, and conflict resolution',
		mustInclude: ['presence-indicators'],
		anyOf: [
			['websocket-realtime', 'websockets-realtime', 'realtime-engineer'],
			['local-first-sync', 'react-patterns']
		],
		mustNotInclude: ['kubernetes']
	},
	{
		name: 'Social community',
		prompt: 'Build a social community app with profiles, feed, likes, comments, moderation, and notifications',
		mustInclude: ['social-features', 'push-notifications'],
		anyOf: [['social-community', 'community-building', 'community-strategy']]
	}
];

export function evaluateSkillIds(
	testCase: SkillRecommendationEvalCase,
	ids: string[]
): SkillRecommendationEvalResult {
	const idSet = new Set(ids);
	const mustInclude = testCase.mustInclude || [];
	const anyOf = testCase.anyOf || [];
	const mustNotInclude = testCase.mustNotInclude || [];

	const missingRequired = mustInclude.filter((id) => !idSet.has(id));
	const missingAnyOf = anyOf.filter((group) => !group.some((id) => idSet.has(id)));
	const unwanted = mustNotInclude.filter((id) => idSet.has(id));
	const relevantIds = new Set([...mustInclude, ...anyOf.flat()]);
	const relevantReturned = ids.filter((id) => relevantIds.has(id));

	const requiredRecall = mustInclude.length === 0
		? 1
		: (mustInclude.length - missingRequired.length) / mustInclude.length;
	const anyOfRecall = anyOf.length === 0 ? 1 : (anyOf.length - missingAnyOf.length) / anyOf.length;
	const mustNotCleanRate = mustNotInclude.length === 0
		? 1
		: (mustNotInclude.length - unwanted.length) / mustNotInclude.length;
	const labeledPrecisionAtK = ids.length === 0 ? 0 : relevantReturned.length / ids.length;
	const score = Number(
		(
			requiredRecall * 0.45 +
			anyOfRecall * 0.25 +
			mustNotCleanRate * 0.2 +
			labeledPrecisionAtK * 0.1
		).toFixed(4)
	);

	return {
		name: testCase.name,
		prompt: testCase.prompt,
		ids,
		pass: missingRequired.length === 0 && missingAnyOf.length === 0 && unwanted.length === 0,
		score,
		labeledPrecisionAtK,
		requiredRecall,
		anyOfRecall,
		mustNotCleanRate,
		missingRequired,
		missingAnyOf,
		unwanted,
		relevantReturned
	};
}

export function evaluateSkillRecommendations(
	cases: SkillRecommendationEvalCase[] = GOLDEN_RECOMMENDATION_CASES
): SkillRecommendationEvalResult[] {
	return cases.map((testCase) => {
		const ids = rankSkillsForText(testCase.prompt, testCase.maxResults || 10).map((rank) => rank.skillId);
		return evaluateSkillIds(testCase, ids);
	});
}

export function summarizeSkillRecommendationEvals(results: SkillRecommendationEvalResult[]) {
	const caseCount = results.length;
	const passCount = results.filter((result) => result.pass).length;
	const average = (field: keyof Pick<
		SkillRecommendationEvalResult,
		'score' | 'labeledPrecisionAtK' | 'requiredRecall' | 'anyOfRecall' | 'mustNotCleanRate'
	>) => results.reduce((sum, result) => sum + result[field], 0) / Math.max(1, caseCount);

	return {
		caseCount,
		passCount,
		passRate: passCount / Math.max(1, caseCount),
		averageScore: average('score'),
		averageLabeledPrecisionAtK: average('labeledPrecisionAtK'),
		averageRequiredRecall: average('requiredRecall'),
		averageAnyOfRecall: average('anyOfRecall'),
		averageMustNotCleanRate: average('mustNotCleanRate'),
		failures: results.filter((result) => !result.pass).map((result) => result.name)
	};
}
