import { rankSkillsForText } from './h70-skill-matcher';

export interface SkillRecommendationEvalCase {
	name: string;
	prompt: string;
	suite?: 'golden' | 'challenge';
	mustInclude?: string[];
	anyOf?: string[][];
	mustNotInclude?: string[];
	maxResults?: number;
}

export interface SkillRecommendationEvalResult {
	name: string;
	prompt: string;
	suite: 'golden' | 'challenge';
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

export interface SkillCoverageGap {
	skillId: string;
	path: string;
	why: string;
}

export const COVERAGE_GAPS_BY_CASE: Record<string, SkillCoverageGap> = {
	'Notification preferences': {
		skillId: 'notification-preferences',
		path: 'backend/notification-preferences.yaml',
		why: 'Current matches use push, email, forms, and accessibility proxies instead of a dedicated preference-center skill.'
	},
	'Outgoing webhook platform': {
		skillId: 'webhook-provider-platform',
		path: 'backend/webhook-provider-platform.yaml',
		why: 'Current webhook skill is mostly inbound processing; outgoing subscriptions, signing, and delivery logs deserve their own surface.'
	},
	'Bulk admin actions': {
		skillId: 'bulk-actions-safety',
		path: 'frontend/bulk-actions-safety.yaml',
		why: 'Current matches cover tables and audit logs, but not partial failure, undo, and confirmation ergonomics.'
	},
	'Data retention deletion': {
		skillId: 'data-retention-deletion',
		path: 'security/data-retention-deletion.yaml',
		why: 'Current matches are privacy and cron proxies; retention policy implementation is a distinct recurring request.'
	},
	'Usage metering entitlements': {
		skillId: 'usage-metering-entitlements',
		path: 'backend/usage-metering-entitlements.yaml',
		why: 'Current matches cover billing and analytics, but not runtime quotas, feature gates, and entitlement enforcement.'
	},
	'Onboarding checklist': {
		skillId: 'feature-onboarding-checklists',
		path: 'product/feature-onboarding-checklists.yaml',
		why: 'Current matches cover analytics and onboarding broadly, but not checklist state, activation tasks, and completion UX.'
	},
	'Permissioned file sharing': {
		skillId: 'permissioned-file-sharing',
		path: 'backend/permissioned-file-sharing.yaml',
		why: 'Current matches cover uploads and RBAC separately; share links, expiry, and file ACLs need one focused skill.'
	},
	'Product feedback board': {
		skillId: 'product-feedback-roadmapping',
		path: 'product/product-feedback-roadmapping.yaml',
		why: 'Current matches use social, analytics, and changelog proxies instead of feedback capture and roadmap workflow.'
	},
	'App store release ops': {
		skillId: 'app-store-release-ops',
		path: 'mobile/app-store-release-ops.yaml',
		why: 'Current matches cover Expo and push, but not TestFlight, Play Console, metadata, and rollout operations.'
	},
	'Accessibility QA pass': {
		skillId: 'web-accessibility-qa',
		path: 'testing/web-accessibility-qa.yaml',
		why: 'Current matches cover accessibility and Playwright separately; QA pass structure should be its own skill.'
	},
	'Privacy consent manager': {
		skillId: 'privacy-consent-management',
		path: 'security/privacy-consent-management.yaml',
		why: 'Current matches cover GDPR and analytics, but not cookie consent, tracking preferences, and consent records.'
	},
	'Realtime collaboration conflicts': {
		skillId: 'realtime-collab-conflict-resolution',
		path: 'backend/realtime-collab-conflict-resolution.yaml',
		why: 'Current matches cover realtime and local-first primitives, not conflict-resolution decisions.'
	}
};

export const GOLDEN_RECOMMENDATION_CASES: SkillRecommendationEvalCase[] = [
	{
		name: 'RAG chatbot',
		prompt: 'Build a production RAG chatbot with embeddings, vector retrieval, semantic search, citations, and prompt evaluation',
		mustInclude: ['semantic-search', 'llm-architect'],
		anyOf: [
			['rag-engineer', 'rag-implementation', 'vector-specialist'],
			['ai-observability'],
			['openai-api-patterns']
		],
		mustNotInclude: ['nft-engineer', 'streamer-bait-design', 'portfolio-optimization', 'neural-architecture-search']
	},
	{
		name: 'AI art consistency',
		prompt: 'Create a consistent AI art series with the same character, visual style, image generation, and shot continuity',
		mustInclude: ['art-consistency', 'ai-image-generation', 'ai-video-generation'],
		anyOf: [
			['character-design', 'concept-art'],
			['ai-creative-director'],
			['ai-game-art-generation'],
			['prompt-engineering-creative']
		],
		mustNotInclude: ['rate-limiting', 'digital-product-delivery']
	},
	{
		name: 'Mobile app',
		prompt: 'Build a mobile app with Expo and React Native, native iOS and Android integrations, push notifications, and app store deployment',
		mustInclude: ['expo', 'react-native-specialist', 'ios-swift-specialist', 'android-kotlin-specialist'],
		maxResults: 13,
		anyOf: [
			['push-notifications'],
			['state-management'],
			['react-patterns', 'frontend'],
			['responsive-mobile-first']
		],
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
		maxResults: 13,
		anyOf: [
			['auth-specialist', 'authentication-oauth', 'nextjs-supabase-auth'],
			['stripe-integration', 'stripe-subscriptions', 'subscription-billing'],
			['analytics', 'analytics-architecture', 'product-analytics', 'dashboard-design'],
			['saas-teams-organizations'],
			['onboarding-flows']
		]
	},
	{
		name: 'Multiplayer game',
		prompt: 'Build a multiplayer roguelike game with procedural dungeons, inventory, combat, and online sync',
		mustInclude: ['game-development'],
		anyOf: [
			['game-networking', 'websocket-realtime'],
			['procedural-generation', 'roguelike-dungeon', 'game-design-core'],
			['combat-design'],
			['game-ai-behavior', 'game-ai-behavior-trees'],
			['game-design'],
			['llm-game-development']
		]
	},
	{
		name: 'Ecommerce checkout',
		prompt: 'Build an ecommerce checkout with cart, Stripe payments, digital product delivery, email receipts, and analytics',
		mustInclude: ['ecommerce-cart-checkout', 'stripe-integration', 'digital-product-delivery'],
		anyOf: [['resend-email', 'email-deliverability', 'email-marketing', 'email-systems'], ['analytics']]
	},
	{
		name: 'AI agent tooling',
		prompt: 'Build an AI agent with tool calling, memory, multi-agent orchestration, and MCP server integration',
		mustInclude: ['agent-tool-builder', 'agent-memory-systems'],
		anyOf: [
			['ai-function-calling'],
			['multi-agent-orchestration', 'ai-agents-architect'],
			['mcp-server-development', 'mcp-developer'],
			['agent-communication'],
			['computer-use-agents']
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
		anyOf: [
			['gdpr-privacy', 'privacy-guardian'],
			['security'],
			['identity-access-management', 'security-engineer'],
			['auth-specialist', 'security-owasp']
		]
	},
	{
		name: 'Web3 NFT marketplace',
		prompt: 'Build a Web3 NFT marketplace with wallet login, smart contracts, minting, royalties, and token-gated community',
		mustInclude: ['nft-engineer', 'smart-contract-engineer', 'wallet-integration'],
		anyOf: [
			['web3-community', 'blockchain-defi'],
			['nft-systems'],
			['auth-specialist'],
			['community-building', 'community-operations', 'community-led-growth']
		]
	},
	{
		name: 'SEO landing page',
		prompt: 'Build a SEO landing page with copywriting, conversion rate optimization, waitlist capture, and analytics',
		mustInclude: ['seo', 'copywriting', 'conversion-rate-optimization'],
		anyOf: [
			['landing-page-design', 'waitlist-launch-pages'],
			['analytics'],
			['ad-copywriting']
		]
	},
	{
		name: 'Data pipeline',
		prompt: 'Build a data pipeline with ETL, warehouse analytics, dashboards, metrics, and data quality checks',
		mustInclude: ['data-pipeline', 'data-engineer', 'analytics'],
		anyOf: [
			['observability', 'observability-sre', 'analytics-architecture'],
			['event-architect'],
			['infra-architect'],
			['postgres-wizard', 'migration-specialist']
		]
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
		anyOf: [
			['semantic-search', 'rag-engineer', 'rag-implementation'],
			['llm-architect'],
			['ai-observability']
		]
	},
	{
		name: 'Voice AI support',
		prompt: 'Build a voice AI support bot with speech to text, text to speech, Twilio calls, and conversation memory',
		mustInclude: ['voice-ai-development', 'twilio-communications'],
		anyOf: [
			['voice-agents', 'conversation-memory'],
			['ai-chatbot-builder'],
			['context-window-management', 'prompt-caching', 'rag-implementation']
		]
	},
	{
		name: 'Realtime whiteboard',
		prompt: 'Build a realtime collaborative whiteboard with presence, websocket sync, optimistic updates, and conflict resolution',
		mustInclude: ['presence-indicators'],
		anyOf: [
			['websocket-realtime', 'websockets-realtime', 'realtime-engineer'],
			['local-first-sync', 'react-patterns'],
			['realtime-chat-systems'],
			['observability']
		],
		mustNotInclude: ['kubernetes']
	},
	{
		name: 'Social community',
		prompt: 'Build a social community app with profiles, feed, likes, comments, moderation, and notifications',
		mustInclude: ['social-features', 'push-notifications'],
		anyOf: [
			['social-community', 'community-building', 'community-strategy'],
			['community-operations'],
			['community-analytics'],
			['community-led-growth', 'developer-community', 'community-tooling']
		]
	},
	{
		name: 'File upload storage',
		prompt: 'Add file upload with S3-compatible storage, image optimization, signed URLs, and upload validation',
		mustInclude: ['file-uploads'],
		anyOf: [['image-optimization-cdn'], ['forms-validation', 'zod-validation']],
		mustNotInclude: [
			'conversion-rate-optimization',
			'cloud-cost-optimization',
			'model-optimization',
			'portfolio-optimization'
		]
	},
	{
		name: 'Webhook ingestion',
		prompt: 'Implement webhook ingestion with signature verification, retries, idempotency, and event logging',
		mustInclude: ['webhook-processing'],
		anyOf: [['logging-strategies', 'audit-logging'], ['observability']]
	},
	{
		name: 'Postgres migrations',
		prompt: 'Design a Postgres schema with migrations, Drizzle ORM, tenant-aware data model, and indexes',
		mustInclude: ['drizzle-orm', 'database-schema-design', 'database-migrations'],
		anyOf: [
			['postgres-wizard', 'database-architect'],
			['prisma'],
			['graphql'],
			['redis-specialist']
		]
	},
	{
		name: 'Faceted search',
		prompt: 'Build faceted search with Algolia, filters, sorting, typo tolerance, and semantic fallback',
		mustInclude: ['algolia-search', 'search-implementation'],
		anyOf: [['semantic-search']]
	},
	{
		name: 'Queue workers',
		prompt: 'Add queue workers for background jobs with retries, dead letters, and scheduled cron tasks',
		mustInclude: ['queue-workers', 'cron-scheduled-jobs'],
		anyOf: [['pg-boss', 'trigger-dev', 'upstash-qstash']]
	},
	{
		name: 'Next.js frontend',
		prompt: 'Build a Next.js app router frontend with server actions, middleware auth, and Tailwind UI',
		mustInclude: ['nextjs-app-router', 'nextjs-server-actions', 'tailwind-ui'],
		anyOf: [['auth-specialist', 'clerk-auth', 'authentication-oauth'], ['frontend']]
	},
	{
		name: 'Form validation',
		prompt: 'Add form validation with Zod schemas, accessible errors, and multi-step wizard state',
		mustInclude: ['zod-validation', 'forms-validation'],
		anyOf: [['state-management', 'accessibility']]
	},
	{
		name: 'API abuse defense',
		prompt: 'Implement rate limiting and API security for a public REST API with abuse monitoring',
		mustInclude: ['api-security', 'rate-limiting'],
		anyOf: [['api-design', 'api-designer'], ['observability', 'threat-modeling']]
	},
	{
		name: 'Observability stack',
		prompt: 'Add observability with structured logs, traces, metrics, alerts, and Sentry error tracking',
		mustInclude: ['observability', 'sentry-error-tracking'],
		anyOf: [['observability-sre', 'ai-observability', 'langfuse'], ['analytics']],
		mustNotInclude: ['postgres-wizard', 'data-engineer', 'data-pipeline', 'sustainability-metrics']
	},
	{
		name: 'API error handling',
		prompt: 'Add robust API error handling with typed error responses, retry-safe failures, logging, and user-facing fallbacks',
		mustInclude: ['error-handling', 'logging-strategies'],
		anyOf: [['api-design', 'api-designer'], ['observability', 'sentry-error-tracking']]
	},
	{
		name: 'Admin dashboard',
		prompt: 'Build an admin dashboard with TanStack Table, charts, filters, RBAC, and audit logs',
		mustInclude: ['tanstack-table', 'audit-logging', 'rbac-enterprise'],
		anyOf: [['analytics-architecture', 'data-engineer']]
	},
	{
		name: 'Telegram mini app',
		prompt: 'Create a Telegram bot mini app with payments, notifications, and community onboarding',
		mustInclude: ['telegram-bot-builder', 'telegram-mini-app'],
		anyOf: [['stripe-integration'], ['push-notifications'], ['community-operations', 'community-building']]
	},
	{
		name: 'Shopify storefront',
		prompt: 'Build a Shopify storefront with Liquid theme edits, checkout extensions, product catalog, and Klaviyo email',
		mustInclude: ['shopify-store-builder', 'klaviyo-ecommerce'],
		anyOf: [['ecommerce-cart-checkout'], ['resend-email', 'email-deliverability', 'email-systems']]
	},
	{
		name: 'Internationalization',
		prompt: 'Add internationalization with locale routing, translation files, pluralization, and RTL layout',
		mustInclude: ['i18n']
	},
	{
		name: 'Desktop app',
		prompt: 'Build a desktop app with Tauri, local storage, auto-updates, and native file access',
		mustInclude: ['tauri-desktop'],
		anyOf: [['local-first-sync'], ['file-uploads']]
	},
	{
		name: 'Chrome extension task',
		prompt: 'Create a Chrome extension with content scripts, background service worker, and Playwright tests',
		mustInclude: ['browser-extension-builder', 'playwright-testing'],
		anyOf: [['browser-automation']],
		mustNotInclude: [
			'content-strategy',
			'content-creation',
			'ai-content-analytics',
			'ai-content-qa',
			'real-time-content',
			'pwa-progressive-web-app',
			'microservices-patterns',
			'queue-workers'
		]
	},
	{
		name: 'Passkeys auth',
		prompt: 'Add passkeys and WebAuthn login with session security and OAuth fallback',
		mustInclude: ['passkeys-webauthn', 'authentication-oauth', 'auth-specialist'],
		anyOf: [
			['security', 'security-hardening'],
			['api-security', 'security-owasp', 'cybersecurity', 'security-engineer'],
			['ai-code-security']
		]
	},
	{
		name: 'Supabase backend',
		prompt: 'Build a Supabase backend with RLS policies, auth, edge functions, and storage buckets',
		mustInclude: ['supabase-backend', 'supabase-security', 'supabase-auth-rls'],
		anyOf: [['auth-specialist', 'nextjs-supabase-auth'], ['database-architect']]
	},
	{
		name: 'Claude Code CI',
		prompt: 'Set up CI/CD for Claude Code commands, hooks, testing automation, and release notes',
		mustInclude: ['claude-code-commands', 'claude-code-cicd', 'claude-code-hooks', 'testing-automation'],
		anyOf: [['automation', 'ai-workflow-automation']]
	},
	{
		name: 'GraphQL API',
		prompt: 'Build a GraphQL API with schema design, resolvers, subscriptions, and auth guards',
		mustInclude: ['graphql', 'graphql-architect'],
		anyOf: [['auth-specialist', 'authentication-oauth'], ['api-design', 'api-designer']]
	},
	{
		name: 'Caching stack',
		prompt: 'Add caching with Redis, CDN headers, TanStack Query, and invalidation rules',
		mustInclude: ['tanstack-query', 'caching-patterns', 'redis-specialist'],
		anyOf: [['image-optimization-cdn']]
	},
	{
		name: 'Video streaming',
		prompt: 'Create a video streaming feature with upload processing, transcoding, thumbnails, and playback analytics',
		mustInclude: ['video-streaming-infrastructure', 'video-embedding-streaming'],
		anyOf: [['analytics', 'analytics-architecture'], ['ai-video-generation'], ['data-engineer']]
	},
	{
		name: 'Slack bot',
		prompt: 'Build a Slack bot with slash commands, OAuth install flow, webhooks, and alerts',
		mustInclude: ['slack-bot-builder', 'authentication-oauth'],
		anyOf: [['webhook-processing', 'discord-bot-architect', 'telegram-bot-builder']]
	},
	{
		name: 'Onboarding analytics',
		prompt: 'Design onboarding flows with activation analytics, lifecycle emails, and conversion experiments',
		mustInclude: ['onboarding-flows', 'analytics', 'conversion-rate-optimization'],
		anyOf: [['experimental-design', 'product-analytics-engineering'], ['player-onboarding']]
	},
	{
		name: 'Enterprise SaaS',
		prompt: 'Build a multi-tenant enterprise SaaS with RBAC, SSO SAML, SCIM provisioning, and audit logs',
		mustInclude: ['saas-teams-organizations', 'rbac-enterprise', 'sso-saml', 'scim-provisioning'],
		anyOf: [['multi-tenancy'], ['audit-logging', 'audit-trail-activity-feed']]
	},
	{
		name: 'Security platform hardening',
		prompt: 'Implement secrets management, container security, supply chain scanning, and threat modeling',
		mustInclude: ['secrets-management', 'container-security', 'threat-modeling'],
		anyOf: [['security', 'security-engineer', 'cybersecurity'], ['supply-chain-security']]
	},
	{
		name: 'Fintech integration',
		prompt: 'Build a fintech integration with Plaid, Stripe payouts, ledger reconciliation, and risk checks',
		mustInclude: ['fintech-integration', 'plaid-fintech', 'stripe-integration'],
		anyOf: [['risk-modeling', 'risk-management-trading']]
	},
	{
		name: 'Course platform',
		prompt: 'Create a course platform with live education, student progress, content modules, and community support',
		mustInclude: ['live-education', 'course-creation'],
		anyOf: [['education-platforms', 'education-business'], ['customer-support', 'community-building']]
	},
	{
		name: 'Monorepo devex',
		prompt: 'Set up monorepo management with Turborepo, package publishing, TypeScript strictness, and developer experience',
		mustInclude: ['monorepo-management', 'turborepo-monorepo', 'npm-publishing', 'developer-experience'],
		anyOf: [['typescript-strict']]
	},
	{
		name: 'Serverless edge API',
		prompt: 'Build a serverless edge API with Hono, Cloudflare Workers, rate limits, and durable caching',
		mustInclude: ['cloudflare-workers-deep', 'hono-edge', 'rate-limiting'],
		anyOf: [['edge-first-architecture'], ['caching-patterns']]
	},
	{
		name: 'AI evaluation harness',
		prompt: 'Create an AI evaluation harness with Langfuse tracing, RAGAS metrics, prompt caching, and regression tests',
		mustInclude: ['langfuse', 'prompt-caching', 'agent-evaluation'],
		anyOf: [['observability', 'ai-observability']]
	},
	{
		name: 'Computer-use browser agent',
		prompt: 'Build computer-use agent browser automation with Playwright, screenshots, and tool-use safety',
		mustInclude: ['computer-use-agents', 'browser-automation', 'playwright-testing'],
		anyOf: [['agent-tool-builder'], ['ai-safety-alignment', 'testing-automation']]
	}
];

export const CHALLENGE_RECOMMENDATION_CASES: SkillRecommendationEvalCase[] = [
	{
		name: 'Password reset',
		suite: 'challenge',
		prompt: 'Add forgot password and reset password email flow with token expiry, session security, and success toast',
		mustInclude: ['auth-specialist'],
		anyOf: [
			['resend-email', 'email-deliverability', 'email-systems'],
			['toast-notification-ui'],
			['authentication-oauth', 'security', 'security-hardening', 'security-owasp'],
			['cryptography']
		],
		mustNotInclude: ['passkeys-webauthn', 'nft-engineer']
	},
	{
		name: 'CSV import admin',
		suite: 'challenge',
		prompt: 'Build an admin CSV import tool with upload validation, preview table, row errors, and audit log',
		mustInclude: ['file-uploads', 'tanstack-table', 'audit-logging'],
		anyOf: [['forms-validation', 'zod-validation']],
		mustNotInclude: ['ai-image-generation', 'nft-engineer']
	},
	{
		name: 'User settings page',
		suite: 'challenge',
		prompt: 'Create account settings for profile editing, email preferences, password change, notification toggles, and accessible forms',
		mustInclude: ['forms-validation', 'accessibility'],
		anyOf: [['auth-specialist', 'authentication-oauth'], ['toast-notification-ui', 'push-notifications']],
		mustNotInclude: ['smart-contract-engineer']
	},
	{
		name: 'Search filter table',
		suite: 'challenge',
		prompt: 'Add searchable sortable filterable data table with saved views, pagination, bulk actions, and CSV export',
		mustInclude: ['tanstack-table', 'search-implementation'],
		anyOf: [['frontend'], ['infinite-scroll-pagination']],
		mustNotInclude: ['semantic-search', 'rag-engineer']
	},
	{
		name: 'PWA offline sync',
		suite: 'challenge',
		prompt: 'Build a progressive web app that works offline, caches assets, syncs local changes later, and sends push notifications',
		mustInclude: ['pwa-progressive-web-app', 'local-first-sync', 'push-notifications'],
		anyOf: [['caching-patterns']],
		mustNotInclude: ['kubernetes']
	},
	{
		name: 'Calendar booking',
		suite: 'challenge',
		prompt: 'Build a calendar booking app with availability rules, reminders, timezone handling, email confirmations, and payment deposits',
		anyOf: [
			['productivity-ai-tools'],
			['resend-email', 'email-deliverability', 'email-systems'],
			['stripe-integration', 'stripe-subscriptions'],
			['push-notifications'],
			['lemonsqueezy-payments']
		],
		mustNotInclude: ['nft-engineer', 'smart-contract-engineer']
	},
	{
		name: 'Invoice PDF receipts',
		suite: 'challenge',
		prompt: 'Generate invoices and PDF receipts after checkout, email them to customers, and store them for account history',
		mustInclude: ['document-ai'],
		anyOf: [
			['stripe-integration'],
			['resend-email', 'email-deliverability', 'email-systems'],
			['ecommerce-cart-checkout'],
			['digital-product-delivery']
		],
		mustNotInclude: ['nft-engineer']
	},
	{
		name: 'Map directory',
		suite: 'challenge',
		prompt: 'Build a local business directory with map search, filters, saved places, reviews, and mobile responsive cards',
		mustInclude: ['responsive-mobile-first', 'search-implementation'],
		anyOf: [['social-features'], ['frontend'], ['algolia-search'], ['accessibility', 'react-patterns', 'map-location-features']],
		mustNotInclude: ['procedural-generation', 'game-development']
	},
	{
		name: 'RBAC settings',
		suite: 'challenge',
		prompt: 'Add team settings with role based permissions, invites, audit log, organization billing, and SSO readiness',
		mustInclude: ['rbac-enterprise', 'saas-teams-organizations'],
		anyOf: [['audit-logging', 'audit-trail-activity-feed'], ['sso-saml'], ['stripe-integration', 'subscription-billing']],
		mustNotInclude: ['game-development']
	},
	{
		name: 'Image gallery upload',
		suite: 'challenge',
		prompt: 'Build drag and drop image gallery upload with compression, CDN optimization, captions, moderation, and accessible keyboard controls',
		mustInclude: ['file-uploads', 'image-optimization-cdn', 'accessibility'],
		anyOf: [['social-features', 'community-operations']],
		mustNotInclude: ['model-optimization', 'portfolio-optimization']
	},
	{
		name: 'Support ticket inbox',
		suite: 'challenge',
		prompt: 'Create a customer support ticket inbox with assignment, status filters, email replies, internal notes, SLA alerts, and analytics',
		mustInclude: ['customer-support', 'email-systems', 'analytics'],
		anyOf: [
			['tanstack-table'],
			['push-notifications'],
			['resend-email'],
			['customer-success'],
			['team-communications', 'support-ticketing-workflows'],
			['analytics-architecture', 'data-engineer']
		],
		mustNotInclude: ['nft-engineer']
	},
	{
		name: 'AI meeting notes',
		suite: 'challenge',
		prompt: 'Build AI meeting notes from audio recordings with transcription, speaker summaries, action items, search, and export',
		mustInclude: ['voice-ai-development', 'structured-output'],
		anyOf: [
			['semantic-search'],
			['productivity-ai-tools', 'document-ai'],
			['search-implementation', 'algolia-search']
		],
		mustNotInclude: ['smart-contract-engineer', 'neural-architecture-search']
	},
	{
		name: 'Notification preferences',
		suite: 'challenge',
		prompt: 'Create a notification preference center with email opt outs, push notification toggles, digest frequency, quiet hours, and accessible forms',
		mustInclude: ['push-notifications', 'forms-validation', 'accessibility'],
		anyOf: [
			['resend-email', 'email-deliverability', 'email-systems'],
			['toast-notification-ui']
		],
		mustNotInclude: ['nft-engineer', 'smart-contract-engineer']
	},
	{
		name: 'Outgoing webhook platform',
		suite: 'challenge',
		prompt: 'Build an outgoing webhook platform with endpoint subscriptions, HMAC signing, retries, delivery logs, rate limits, and a developer portal',
		mustInclude: ['webhook-processing', 'api-security', 'logging-strategies'],
		anyOf: [['rate-limiting'], ['api-design', 'api-designer', 'developer-community']],
		mustNotInclude: ['ai-image-generation', 'procedural-generation']
	},
	{
		name: 'Bulk admin actions',
		suite: 'challenge',
		prompt: 'Add bulk admin actions to a data table with row selection, confirmation dialogs, partial failure handling, audit log entries, and undo toasts',
		mustInclude: ['tanstack-table', 'audit-logging'],
		anyOf: [['logging-strategies'], ['frontend']],
		mustNotInclude: ['semantic-search', 'rag-engineer']
	},
	{
		name: 'Data retention deletion',
		suite: 'challenge',
		prompt: 'Implement data retention policies with scheduled deletion jobs, account export, GDPR delete requests, audit logs, and privacy controls',
		mustInclude: ['gdpr-privacy', 'audit-logging'],
		anyOf: [['privacy-guardian'], ['cron-scheduled-jobs', 'queue-workers']],
		mustNotInclude: ['nft-engineer', 'streamer-bait-design']
	},
	{
		name: 'Usage metering entitlements',
		suite: 'challenge',
		prompt: 'Add usage metering for a SaaS plan with monthly quotas, feature entitlements, billing analytics, Stripe subscription limits, and upgrade prompts',
		mustInclude: ['subscription-billing', 'stripe-integration', 'analytics'],
		anyOf: [['stripe-subscriptions'], ['saas-teams-organizations'], ['api-monetization', 'analytics-architecture']],
		mustNotInclude: ['game-development']
	},
	{
		name: 'Onboarding checklist',
		suite: 'challenge',
		prompt: 'Build an onboarding checklist with activation milestones, progress tracking, lifecycle emails, analytics events, and completion celebration',
		mustInclude: ['onboarding-flows', 'analytics'],
		anyOf: [
			['product-analytics-engineering', 'analytics-architecture'],
			['player-onboarding']
		],
		mustNotInclude: ['smart-contract-engineer']
	},
	{
		name: 'Permissioned file sharing',
		suite: 'challenge',
		prompt: 'Create permissioned file sharing with signed URLs, expiring share links, workspace access control, upload validation, and audit history',
		mustInclude: ['file-uploads'],
		anyOf: [
			['auth-specialist', 'authentication-oauth', 'rbac-enterprise', 'roles-permissions-ui'],
			['forms-validation', 'zod-validation']
		],
		mustNotInclude: ['ai-video-generation']
	},
	{
		name: 'Product feedback board',
		suite: 'challenge',
		prompt: 'Build a product feedback board with idea submission, voting, status roadmap columns, admin moderation, user comments, and analytics',
		mustInclude: ['analytics', 'social-features'],
		anyOf: [
			['changelog-roadmap', 'product-management'],
			['product-analytics-engineering', 'analytics-architecture']
		],
		mustNotInclude: ['nft-engineer', 'kubernetes']
	},
	{
		name: 'App store release ops',
		suite: 'challenge',
		prompt: 'Prepare an Expo React Native app for TestFlight and Play Console release with push notification credentials, app metadata, screenshots, and phased rollout',
		mustInclude: ['expo', 'react-native-specialist', 'push-notifications'],
		maxResults: 11,
		anyOf: [['firebase', 'state-management'], ['responsive-mobile-first', 'react-patterns']],
		mustNotInclude: ['kubernetes-deployment', 'mobile-game-dev']
	},
	{
		name: 'Accessibility QA pass',
		suite: 'challenge',
		prompt: 'Run an accessibility QA pass for keyboard navigation, focus states, screen reader labels, color contrast, Playwright checks, and form error messages',
		mustInclude: ['accessibility', 'playwright-testing'],
		anyOf: [['accessibility-design'], ['browser-automation', 'testing-automation', 'web-accessibility-qa'], ['ui-design']],
		mustNotInclude: ['smart-contract-engineer']
	},
	{
		name: 'Privacy consent manager',
		suite: 'challenge',
		prompt: 'Add cookie consent and privacy controls with analytics opt out, regional GDPR behavior, tracking preferences, and audit-friendly consent records',
		mustInclude: ['gdpr-privacy', 'privacy-guardian', 'analytics'],
		anyOf: [['analytics-architecture', 'posthog-analytics', 'plausible-analytics']],
		mustNotInclude: ['nft-engineer']
	},
	{
		name: 'Realtime collaboration conflicts',
		suite: 'challenge',
		prompt: 'Build realtime collaborative editing with presence cursors, websocket sync, offline local edits, conflict resolution, optimistic updates, and activity history',
		mustInclude: ['presence-indicators', 'local-first-sync'],
		anyOf: [
			['websocket-realtime', 'websockets-realtime', 'realtime-engineer'],
			['audit-logging', 'logging-strategies'],
			['observability']
		],
		mustNotInclude: ['procedural-generation', 'game-development']
	}
];

export const DASHBOARD_RECOMMENDATION_CASES: SkillRecommendationEvalCase[] = [
	...GOLDEN_RECOMMENDATION_CASES,
	...CHALLENGE_RECOMMENDATION_CASES
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
		suite: testCase.suite || 'golden',
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
