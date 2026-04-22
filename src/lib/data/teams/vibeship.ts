// Vibeship Agentic Workforce Team Configuration
// Generated from vibeship-team/agents/index.yaml

import type { AgenticTeam } from '$lib/types/teams';

export const vibeshipTeam: AgenticTeam = {
	id: 'vibeship-workforce',
	version: '1.0.0',
	name: 'Vibeship Agentic Workforce',
	description: '36 specialized AI agents across 6 divisions',
	source_path: 'C:/Users/USER/Desktop/vibeship-team/agents',
	infrastructure: {
		h70_mcp: {
			server: 'spawner-h70',
			tool: 'spawner_h70_skills',
			skill_lab: 'C:/Users/USER/Desktop/spark-skill-graphs'
		}
	},
	divisions: {
		content: {
			name: 'Content Division',
			commander: 'content-commander',
			description: 'Content creation, distribution, and engagement',
			agents: [
				{
					id: 'content-commander',
					name: 'Content Commander',
					role: 'Commander',
					division: 'content',
					description: 'Commands all content operations',
					file: 'content/commander.yaml',
					h70_skills: ['content-strategy', 'content-creation']
				},
				{
					id: 'thread-writer',
					name: 'Thread Writer',
					role: 'Specialist',
					division: 'content',
					description: 'Expert at viral Twitter/X threads',
					file: 'content/thread-writer.yaml',
					h70_skills: ['copywriting', 'viral-hooks']
				},
				{
					id: 'article-writer',
					name: 'Article Writer',
					role: 'Specialist',
					division: 'content',
					description: 'Expert at SEO-optimized blog posts',
					file: 'content/article-writer.yaml',
					h70_skills: ['blog-writing', 'seo']
				},
				{
					id: 'visual-agent',
					name: 'Visual Agent',
					role: 'Specialist',
					division: 'content',
					description: 'Expert at AI image and video generation',
					file: 'content/visual-agent.yaml',
					h70_skills: ['ai-image-generation', 'ai-video-generation']
				},
				{
					id: 'repurpose-agent',
					name: 'Repurpose Agent',
					role: 'Specialist',
					division: 'content',
					description: 'Expert at content repurposing',
					file: 'content/repurpose-agent.yaml',
					h70_skills: ['content-creation', 'ai-content-qa']
				},
				{
					id: 'engagement-agent',
					name: 'Engagement Agent',
					role: 'Specialist',
					division: 'content',
					description: 'Expert at real-time engagement',
					file: 'content/engagement-agent.yaml',
					h70_skills: ['platform-algorithms', 'real-time-content']
				}
			]
		},
		product: {
			name: 'Product Division',
			commander: 'product-commander',
			description: 'Product development, quality, and documentation',
			agents: [
				{
					id: 'product-commander',
					name: 'Product Commander',
					role: 'Commander',
					division: 'product',
					description: 'Commands all product operations',
					file: 'product/commander.yaml',
					h70_skills: ['product-management', 'product-strategy']
				},
				{
					id: 'feature-spec-writer',
					name: 'Feature Spec Writer',
					role: 'Specialist',
					division: 'product',
					description: 'Expert at PRDs and feature specs',
					file: 'product/feature-spec-writer.yaml',
					h70_skills: ['product-management', 'docs-engineer']
				},
				{
					id: 'code-review-agent',
					name: 'Code Review Agent',
					role: 'Specialist',
					division: 'product',
					description: 'Expert at code review and security',
					file: 'product/code-review-agent.yaml',
					h70_skills: ['code-reviewer', 'ai-code-security']
				},
				{
					id: 'testing-agent',
					name: 'Testing Agent',
					role: 'Specialist',
					division: 'product',
					description: 'Expert at test architecture',
					file: 'product/testing-agent.yaml',
					h70_skills: ['test-architect', 'qa-engineering']
				},
				{
					id: 'documentation-agent',
					name: 'Documentation Agent',
					role: 'Specialist',
					division: 'product',
					description: 'Expert at technical documentation',
					file: 'product/documentation-agent.yaml',
					h70_skills: ['docs-engineer', 'knowledge-base-engineering']
				},
				{
					id: 'bug-triage-agent',
					name: 'Bug Triage Agent',
					role: 'Specialist',
					division: 'product',
					description: 'Expert at bug triage and prioritization',
					file: 'product/bug-triage-agent.yaml',
					h70_skills: ['product-management', 'observability']
				}
			]
		},
		community: {
			name: 'Community Division',
			commander: 'community-commander',
			description: 'Community support, engagement, and success',
			agents: [
				{
					id: 'community-commander',
					name: 'Community Commander',
					role: 'Commander',
					division: 'community',
					description: 'Commands all community operations',
					file: 'community/commander.yaml',
					h70_skills: ['community-strategy', 'community-operations']
				},
				{
					id: 'support-agent',
					name: 'Support Agent',
					role: 'Specialist',
					division: 'community',
					description: 'Expert at user support',
					file: 'community/support-agent.yaml',
					h70_skills: ['customer-success']
				},
				{
					id: 'discord-moderator',
					name: 'Discord Moderator',
					role: 'Specialist',
					division: 'community',
					description: 'Expert at Discord moderation',
					file: 'community/discord-moderator.yaml',
					h70_skills: ['community-operations']
				},
				{
					id: 'feedback-collector',
					name: 'Feedback Collector',
					role: 'Specialist',
					division: 'community',
					description: 'Expert at feedback collection and analysis',
					file: 'community/feedback-collector.yaml',
					h70_skills: ['community-analytics', 'research']
				},
				{
					id: 'onboarding-agent',
					name: 'Onboarding Agent',
					role: 'Specialist',
					division: 'community',
					description: 'Expert at user onboarding',
					file: 'community/onboarding-agent.yaml',
					h70_skills: ['customer-success', 'community-growth']
				},
				{
					id: 'success-agent',
					name: 'Success Agent',
					role: 'Specialist',
					division: 'community',
					description: 'Expert at customer success',
					file: 'community/success-agent.yaml',
					h70_skills: ['customer-success', 'community-analytics']
				}
			]
		},
		research: {
			name: 'Research Division',
			commander: 'research-commander',
			description: 'Market research, trends, and competitive intelligence',
			agents: [
				{
					id: 'research-commander',
					name: 'Research Commander',
					role: 'Commander',
					division: 'research',
					description: 'Commands all research operations',
					file: 'research/commander.yaml',
					h70_skills: ['research', 'quantitative-research']
				},
				{
					id: 'competitor-monitor',
					name: 'Competitor Monitor',
					role: 'Specialist',
					division: 'research',
					description: 'Expert at competitive monitoring',
					file: 'research/competitor-monitor.yaml',
					h70_skills: ['research', 'causal-scientist']
				},
				{
					id: 'trend-spotter',
					name: 'Trend Spotter',
					role: 'Specialist',
					division: 'research',
					description: 'Expert at trend detection',
					file: 'research/trend-spotter.yaml',
					h70_skills: ['research', 'ai-trend-alchemy']
				},
				{
					id: 'academic-scanner',
					name: 'Academic Scanner',
					role: 'Specialist',
					division: 'research',
					description: 'Expert at academic paper scanning',
					file: 'research/academic-scanner.yaml',
					h70_skills: ['research', 'scientific-method']
				},
				{
					id: 'market-analyst',
					name: 'Market Analyst',
					role: 'Specialist',
					division: 'research',
					description: 'Expert at market analysis',
					file: 'research/market-analyst.yaml',
					h70_skills: ['research', 'quantitative-research']
				},
				{
					id: 'user-researcher',
					name: 'User Researcher',
					role: 'Specialist',
					division: 'research',
					description: 'Expert at user research',
					file: 'research/user-researcher.yaml',
					h70_skills: ['research', 'community-analytics']
				}
			]
		},
		growth: {
			name: 'Growth Division',
			commander: 'growth-commander',
			description: 'Growth strategy, acquisition, and launches',
			agents: [
				{
					id: 'growth-commander',
					name: 'Growth Commander',
					role: 'Commander',
					division: 'growth',
					description: 'Commands all growth operations',
					file: 'growth/commander.yaml',
					h70_skills: ['growth-strategy', 'growth-loops']
				},
				{
					id: 'seo-agent',
					name: 'SEO Agent',
					role: 'Specialist',
					division: 'growth',
					description: 'Expert at SEO optimization',
					file: 'growth/seo-agent.yaml',
					h70_skills: ['seo', 'content-strategy']
				},
				{
					id: 'paid-acquisition-agent',
					name: 'Paid Acquisition Agent',
					role: 'Specialist',
					division: 'growth',
					description: 'Expert at paid advertising',
					file: 'growth/paid-acquisition-agent.yaml',
					h70_skills: ['ad-copywriting', 'conversion-rate-optimization']
				},
				{
					id: 'partnership-agent',
					name: 'Partnership Agent',
					role: 'Specialist',
					division: 'growth',
					description: 'Expert at strategic partnerships',
					file: 'growth/partnership-agent.yaml',
					h70_skills: ['sales', 'marketing-fundamentals', 'negotiation-playbook']
				},
				{
					id: 'affiliate-manager',
					name: 'Affiliate Manager',
					role: 'Specialist',
					division: 'growth',
					description: 'Expert at affiliate programs',
					file: 'growth/affiliate-manager.yaml',
					h70_skills: ['growth-strategy', 'sales']
				},
				{
					id: 'launch-agent',
					name: 'Launch Agent',
					role: 'Specialist',
					division: 'growth',
					description: 'Expert at product launches',
					file: 'growth/launch-agent.yaml',
					h70_skills: ['go-to-market', 'launch-storytelling']
				}
			]
		},
		operations: {
			name: 'Operations Division',
			commander: 'operations-commander',
			description: 'Operational efficiency, finance, legal, and analytics',
			agents: [
				{
					id: 'operations-commander',
					name: 'Operations Commander',
					role: 'Commander',
					division: 'operations',
					description: 'Commands all operations',
					file: 'operations/commander.yaml',
					h70_skills: ['customer-success', 'automation', 'devops']
				},
				{
					id: 'process-agent',
					name: 'Process Agent',
					role: 'Specialist',
					division: 'operations',
					description: 'Expert at process optimization',
					file: 'operations/process-agent.yaml',
					h70_skills: ['automation', 'docs-engineer', 'devops']
				},
				{
					id: 'finance-agent',
					name: 'Finance Agent',
					role: 'Specialist',
					division: 'operations',
					description: 'Expert at financial operations',
					file: 'operations/finance-agent.yaml',
					h70_skills: ['automation']
				},
				{
					id: 'legal-agent',
					name: 'Legal Agent',
					role: 'Specialist',
					division: 'operations',
					description: 'Expert at legal compliance',
					file: 'operations/legal-agent.yaml',
					h70_skills: ['docs-engineer']
				},
				{
					id: 'analytics-agent',
					name: 'Analytics Agent',
					role: 'Specialist',
					division: 'operations',
					description: 'Expert at data analytics',
					file: 'operations/analytics-agent.yaml',
					h70_skills: ['analytics-architecture', 'observability', 'data-engineer']
				},
				{
					id: 'knowledge-manager',
					name: 'Knowledge Manager',
					role: 'Specialist',
					division: 'operations',
					description: 'Expert at knowledge management',
					file: 'operations/knowledge-manager.yaml',
					h70_skills: ['knowledge-base-engineering', 'docs-engineer', 'enterprise-architecture']
				}
			]
		}
	},
	stats: {
		total_agents: 36,
		commanders: 6,
		specialists: 30,
		divisions: 6,
		unique_h70_skills: 45
	},
	key_handoffs: [
		{ from: 'trend-spotter', to: 'content-commander', trigger: 'viral_content_detected' },
		{ from: 'engagement-agent', to: 'bug-triage-agent', trigger: 'user_comment_about_feature' },
		{ from: 'support-agent', to: 'bug-triage-agent', trigger: 'user_reports_issue' },
		{ from: 'product-commander', to: 'content-commander', trigger: 'feature_shipped' },
		{ from: 'launch-agent', to: 'community-commander', trigger: 'launch_day' },
		{ from: 'research-commander', to: 'growth-commander', trigger: 'market_opportunity_identified' },
		{ from: 'feedback-collector', to: 'product-commander', trigger: 'actionable_feedback' }
	],
	created_at: '2025-01-13T00:00:00Z',
	updated_at: new Date().toISOString()
};
