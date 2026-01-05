import type { WorkflowTemplate, AgentBundle, ProjectTypeOption } from '$lib/types/builder';

export const projectTypes: ProjectTypeOption[] = [
	{ id: 'saas', label: 'SaaS', icon: 'briefcase' },
	{ id: 'marketplace', label: 'Marketplace', icon: 'shopping-cart' },
	{ id: 'ai-app', label: 'AI App', icon: 'cpu' },
	{ id: 'web3', label: 'Web3', icon: 'link' },
	{ id: 'tool', label: 'Tool', icon: 'terminal' },
	{ id: 'other', label: 'Other', icon: 'package' }
];

export const workflowTemplates: WorkflowTemplate[] = [
	{
		id: 'monsterchain-defi-game',
		name: 'MonsterChain DeFi Game',
		description: 'DeFi-powered monster catching game with NFTs, staking, and battle mechanics',
		category: 'web3',
		icon: 'zap',
		nodes: [
			// Row 1: Core Design & Architecture
			{ skillId: 'game-development', offsetX: 0, offsetY: 0 },
			{ skillId: 'defi-architect', offsetX: 280, offsetY: 0 },
			// Row 2: Smart Contracts & Blockchain
			{ skillId: 'smart-contract-engineer', offsetX: 140, offsetY: 120 },
			{ skillId: 'wallet-integration-specialist', offsetX: 420, offsetY: 120 },
			// Row 3: Frontend & Realtime
			{ skillId: 'frontend-engineering', offsetX: 0, offsetY: 240 },
			{ skillId: 'realtime-engineer', offsetX: 280, offsetY: 240 },
			// Row 4: Security & Quality
			{ skillId: 'security-hardening', offsetX: 140, offsetY: 360 }
		],
		connections: [
			// Game Design flows to DeFi tokenomics
			{ sourceIndex: 0, targetIndex: 1 },
			// Both feed into smart contracts
			{ sourceIndex: 0, targetIndex: 2 },
			{ sourceIndex: 1, targetIndex: 2 },
			// DeFi flows to wallet integration
			{ sourceIndex: 1, targetIndex: 3 },
			// Contracts connect to wallet and frontend
			{ sourceIndex: 2, targetIndex: 3 },
			{ sourceIndex: 2, targetIndex: 4 },
			// Wallet connects to frontend
			{ sourceIndex: 3, targetIndex: 4 },
			// Frontend connects to realtime
			{ sourceIndex: 4, targetIndex: 5 },
			// Contracts need security audit
			{ sourceIndex: 2, targetIndex: 6 },
			// Frontend needs security
			{ sourceIndex: 4, targetIndex: 6 }
		],
		suggestedFor: ['web3', 'ai-app']
	},
	{
		id: 'auth-flow',
		name: 'Auth Flow',
		description: 'Complete authentication with Supabase and Next.js',
		category: 'saas',
		icon: 'shield',
		nodes: [
			{ skillId: 'nextjs-supabase-auth', offsetX: 0, offsetY: 0 },
			{ skillId: 'supabase-backend', offsetX: 280, offsetY: 0 },
			{ skillId: 'frontend', offsetX: 560, offsetY: 0 }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 }
		],
		suggestedFor: ['saas', 'marketplace']
	},
	{
		id: 'ai-chat-pipeline',
		name: 'AI Chat Pipeline',
		description: 'RAG-powered chat with LLM orchestration',
		category: 'ai-app',
		icon: 'message-circle',
		nodes: [
			{ skillId: 'rag-implementation', offsetX: 0, offsetY: 0 },
			{ skillId: 'llm-architect', offsetX: 280, offsetY: 0 },
			{ skillId: 'api-design', offsetX: 560, offsetY: 0 },
			{ skillId: 'frontend', offsetX: 840, offsetY: 0 }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 },
			{ sourceIndex: 2, targetIndex: 3 }
		],
		suggestedFor: ['ai-app']
	},
	{
		id: 'api-backend',
		name: 'API Backend',
		description: 'RESTful API with database and caching',
		category: 'general',
		icon: 'server',
		nodes: [
			{ skillId: 'api-design', offsetX: 0, offsetY: 0 },
			{ skillId: 'backend', offsetX: 280, offsetY: 0 },
			{ skillId: 'database-architect', offsetX: 560, offsetY: 0 },
			{ skillId: 'caching-patterns', offsetX: 280, offsetY: 120 }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 },
			{ sourceIndex: 1, targetIndex: 3 }
		],
		suggestedFor: ['saas', 'tool']
	},
	{
		id: 'full-stack-saas',
		name: 'Full Stack SaaS',
		description: 'Complete SaaS with auth, frontend, backend, and deployment',
		category: 'saas',
		icon: 'layers',
		nodes: [
			{ skillId: 'nextjs-app-router', offsetX: 0, offsetY: 0 },
			{ skillId: 'supabase-backend', offsetX: 280, offsetY: 0 },
			{ skillId: 'clerk-auth', offsetX: 0, offsetY: 120 },
			{ skillId: 'vercel-deployment', offsetX: 560, offsetY: 0 }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 2, targetIndex: 0 },
			{ sourceIndex: 1, targetIndex: 3 }
		],
		suggestedFor: ['saas']
	},
	{
		id: 'ai-agent-flow',
		name: 'AI Agent Flow',
		description: 'Multi-agent system with LangGraph orchestration',
		category: 'ai-app',
		icon: 'git-branch',
		nodes: [
			{ skillId: 'ai-agents-architect', offsetX: 0, offsetY: 0 },
			{ skillId: 'langgraph', offsetX: 280, offsetY: 0 },
			{ skillId: 'prompt-engineer', offsetX: 560, offsetY: 0 },
			{ skillId: 'langfuse', offsetX: 280, offsetY: 120 }
		],
		connections: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 },
			{ sourceIndex: 1, targetIndex: 3 }
		],
		suggestedFor: ['ai-app']
	}
];

export const agentBundles: AgentBundle[] = [
	{
		id: 'monsterchain-kit',
		name: 'MonsterChain Kit',
		description: 'Build a DeFi monster catching game with NFTs and tokenomics',
		icon: 'zap',
		skillIds: [
			'game-development',
			'defi-architect',
			'smart-contract-engineer',
			'wallet-integration-specialist',
			'frontend-engineering',
			'realtime-engineer',
			'security-hardening'
		],
		category: 'web3',
		tier: 'premium'
	},
	{
		id: 'saas-starter',
		name: 'SaaS Starter',
		description: 'Everything you need to launch a SaaS product',
		icon: 'rocket',
		skillIds: [
			'nextjs-app-router',
			'supabase-backend',
			'clerk-auth',
			'frontend',
			'vercel-deployment',
			'api-design'
		],
		category: 'full-stack',
		tier: 'free'
	},
	{
		id: 'ai-agent-kit',
		name: 'AI Agent Kit',
		description: 'Build intelligent agents with LLM orchestration',
		icon: 'cpu',
		skillIds: [
			'ai-agents-architect',
			'langgraph',
			'rag-implementation',
			'prompt-engineer',
			'llm-architect',
			'langfuse'
		],
		category: 'ai',
		tier: 'free'
	},
	{
		id: 'backend-essentials',
		name: 'Backend Essentials',
		description: 'Core backend patterns and architecture',
		icon: 'server',
		skillIds: [
			'backend',
			'api-design',
			'database-architect',
			'caching-patterns',
			'error-handling',
			'queue-workers'
		],
		category: 'backend',
		tier: 'free'
	},
	{
		id: 'frontend-pro',
		name: 'Frontend Pro',
		description: 'Modern frontend with React patterns',
		icon: 'layout',
		skillIds: [
			'frontend',
			'react-patterns',
			'nextjs-app-router',
			'vercel-deployment'
		],
		category: 'frontend',
		tier: 'free'
	},
	{
		id: 'security-pack',
		name: 'Security Pack',
		description: 'Secure your application from common threats',
		icon: 'shield',
		skillIds: [
			'auth-specialist',
			'security-owasp',
			'cybersecurity',
			'security-hardening',
			'privacy-guardian'
		],
		category: 'security',
		tier: 'premium'
	},
	{
		id: 'testing-suite',
		name: 'Testing Suite',
		description: 'Comprehensive testing strategy and automation',
		icon: 'check-circle',
		skillIds: [
			'test-architect',
			'testing-automation',
			'qa-engineering',
			'code-review',
			'debugging-master'
		],
		category: 'quality',
		tier: 'free'
	}
];

// Helper to filter templates by project type
export function getTemplatesForProject(projectType: string): WorkflowTemplate[] {
	return workflowTemplates.filter(
		(t) => t.category === projectType || t.category === 'general' || t.suggestedFor?.includes(projectType)
	);
}

// Helper to get all unique skill IDs from templates
export function getTemplateSkillIds(template: WorkflowTemplate): string[] {
	return template.nodes.map((n) => n.skillId);
}
