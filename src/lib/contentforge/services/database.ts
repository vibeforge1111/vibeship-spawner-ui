/**
 * ContentForge Database Service
 *
 * Supabase integration following RLS-first security patterns.
 * CRITICAL: All tables have RLS enabled. Service role is never used client-side.
 */

import type {
	FaucetInput,
	ScrapedData,
	QueueItem,
	QueueStatus,
	SynthesisResult,
	AgentOutput
} from '../types';

// =============================================================================
// Database Types (matching Supabase schema)
// =============================================================================

export interface DbPost {
	id: string;
	external_id: string; // Twitter post ID
	url: string;
	user_id: string; // FK to auth.users
	scraped_data: ScrapedData | null;
	status: QueueStatus;
	priority: number;
	category: string;
	tags: string[];
	created_at: string;
	updated_at: string;
	processed_at: string | null;
}

export interface DbAnalysis {
	id: string;
	post_id: string; // FK to posts
	user_id: string; // FK to auth.users (denormalized for RLS)
	agent_type: string;
	output: AgentOutput<unknown>;
	created_at: string;
}

export interface DbSynthesis {
	id: string;
	post_id: string; // FK to posts
	user_id: string; // FK to auth.users (denormalized for RLS)
	result: SynthesisResult;
	virality_score: number; // Indexed for sorting
	created_at: string;
}

export interface DbPattern {
	id: string;
	user_id: string; // FK to auth.users
	name: string;
	description: string;
	template: string;
	category: string;
	tags: string[];
	usage_count: number;
	effectiveness_score: number;
	created_at: string;
	updated_at: string;
}

export interface DbWatchList {
	id: string;
	user_id: string; // FK to auth.users
	username: string; // Twitter username to watch
	engagement_threshold: number;
	is_active: boolean;
	last_checked_at: string | null;
	created_at: string;
}

// =============================================================================
// SQL Schema (for reference - run via Supabase migrations)
// =============================================================================

export const SCHEMA_SQL = `
-- Enable RLS on ALL tables (CRITICAL: Never skip this)
-- Index columns used in RLS policies for performance

-- Posts table: stores scraped content
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scraped_data JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'vibe_coding',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE(user_id, external_id) -- Prevent duplicate scrapes per user
);

-- RLS: Users can only see their own posts
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_select ON posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY posts_insert ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY posts_update ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY posts_delete ON posts FOR DELETE USING (auth.uid() = user_id);

-- Index for RLS and common queries
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(user_id, status);
CREATE INDEX idx_posts_created ON posts(user_id, created_at DESC);

-- Analyses table: stores agent outputs
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  output JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, agent_type) -- One analysis per agent per post
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY analyses_select ON analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY analyses_insert ON analyses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_analyses_user_id ON analyses(user_id);
CREATE INDEX idx_analyses_post ON analyses(post_id);

-- Syntheses table: combined analysis results
CREATE TABLE IF NOT EXISTS syntheses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  virality_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE syntheses ENABLE ROW LEVEL SECURITY;
CREATE POLICY syntheses_select ON syntheses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY syntheses_insert ON syntheses FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_syntheses_user_id ON syntheses(user_id);
CREATE INDEX idx_syntheses_score ON syntheses(user_id, virality_score DESC);

-- Patterns table: reusable content templates
CREATE TABLE IF NOT EXISTS patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER NOT NULL DEFAULT 0,
  effectiveness_score NUMERIC(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY patterns_all ON patterns FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_patterns_user_id ON patterns(user_id);
CREATE INDEX idx_patterns_category ON patterns(user_id, category);

-- Watch lists table: accounts to monitor
CREATE TABLE IF NOT EXISTS watch_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  engagement_threshold INTEGER NOT NULL DEFAULT 10000,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, username)
);

ALTER TABLE watch_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY watch_lists_all ON watch_lists FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_watch_lists_user_id ON watch_lists(user_id);
CREATE INDEX idx_watch_lists_active ON watch_lists(user_id, is_active) WHERE is_active = true;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER patterns_updated_at BEFORE UPDATE ON patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
`;

// =============================================================================
// Database Client Factory
// =============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Create a ContentForge database client.
 * Pass in the Supabase client from your server context.
 *
 * NEVER use service role client here - only anon/user JWT client.
 */
export function createContentForgeDb(supabase: SupabaseClient) {
	return {
		// Posts
		async createPost(input: FaucetInput, userId: string): Promise<DbPost> {
			const { data, error } = await supabase
				.from('posts')
				.insert({
					external_id: extractPostId(input.url),
					url: input.url,
					user_id: userId,
					category: input.category,
					priority: priorityToNumber(input.priority),
					tags: input.tags,
					status: 'pending'
				})
				.select()
				.single();

			if (error) throw new Error(`Failed to create post: ${error.message}`);
			return data as DbPost;
		},

		async getPost(id: string): Promise<DbPost | null> {
			const { data, error } = await supabase
				.from('posts')
				.select()
				.eq('id', id)
				.single();

			if (error && error.code !== 'PGRST116') {
				throw new Error(`Failed to get post: ${error.message}`);
			}
			return data as DbPost | null;
		},

		async updatePostStatus(id: string, status: QueueStatus): Promise<void> {
			const { error } = await supabase
				.from('posts')
				.update({
					status,
					processed_at: status === 'completed' ? new Date().toISOString() : null
				})
				.eq('id', id);

			if (error) throw new Error(`Failed to update post: ${error.message}`);
		},

		async getPendingPosts(limit = 10): Promise<DbPost[]> {
			const { data, error } = await supabase
				.from('posts')
				.select()
				.eq('status', 'pending')
				.order('priority', { ascending: false })
				.order('created_at', { ascending: true })
				.limit(limit);

			if (error) throw new Error(`Failed to get pending posts: ${error.message}`);
			return (data ?? []) as DbPost[];
		},

		// Analyses
		async saveAnalysis(
			postId: string,
			userId: string,
			agentType: string,
			output: AgentOutput<unknown>
		): Promise<DbAnalysis> {
			const { data, error } = await supabase
				.from('analyses')
				.upsert(
					{
						post_id: postId,
						user_id: userId,
						agent_type: agentType,
						output
					},
					{ onConflict: 'post_id,agent_type' }
				)
				.select()
				.single();

			if (error) throw new Error(`Failed to save analysis: ${error.message}`);
			return data as DbAnalysis;
		},

		async getAnalysesForPost(postId: string): Promise<DbAnalysis[]> {
			const { data, error } = await supabase
				.from('analyses')
				.select()
				.eq('post_id', postId);

			if (error) throw new Error(`Failed to get analyses: ${error.message}`);
			return (data ?? []) as DbAnalysis[];
		},

		// Syntheses
		async saveSynthesis(
			postId: string,
			userId: string,
			result: SynthesisResult
		): Promise<DbSynthesis> {
			const { data, error } = await supabase
				.from('syntheses')
				.upsert(
					{
						post_id: postId,
						user_id: userId,
						result,
						virality_score: result.viralityScore
					},
					{ onConflict: 'post_id' }
				)
				.select()
				.single();

			if (error) throw new Error(`Failed to save synthesis: ${error.message}`);
			return data as DbSynthesis;
		},

		async getTopSyntheses(limit = 20): Promise<DbSynthesis[]> {
			const { data, error } = await supabase
				.from('syntheses')
				.select()
				.order('virality_score', { ascending: false })
				.limit(limit);

			if (error) throw new Error(`Failed to get syntheses: ${error.message}`);
			return (data ?? []) as DbSynthesis[];
		},

		// Patterns
		async savePattern(pattern: Omit<DbPattern, 'id' | 'created_at' | 'updated_at'>): Promise<DbPattern> {
			const { data, error } = await supabase
				.from('patterns')
				.insert(pattern)
				.select()
				.single();

			if (error) throw new Error(`Failed to save pattern: ${error.message}`);
			return data as DbPattern;
		},

		async searchPatterns(query: string, category?: string): Promise<DbPattern[]> {
			let queryBuilder = supabase
				.from('patterns')
				.select()
				.or(`name.ilike.%${query}%,description.ilike.%${query}%,template.ilike.%${query}%`);

			if (category) {
				queryBuilder = queryBuilder.eq('category', category);
			}

			const { data, error } = await queryBuilder.limit(50);

			if (error) throw new Error(`Failed to search patterns: ${error.message}`);
			return (data ?? []) as DbPattern[];
		},

		// Watch Lists
		async createWatchList(username: string, userId: string, threshold = 10000): Promise<DbWatchList> {
			const { data, error } = await supabase
				.from('watch_lists')
				.insert({
					user_id: userId,
					username,
					engagement_threshold: threshold
				})
				.select()
				.single();

			if (error) throw new Error(`Failed to create watch list: ${error.message}`);
			return data as DbWatchList;
		},

		async getActiveWatchLists(): Promise<DbWatchList[]> {
			const { data, error } = await supabase
				.from('watch_lists')
				.select()
				.eq('is_active', true);

			if (error) throw new Error(`Failed to get watch lists: ${error.message}`);
			return (data ?? []) as DbWatchList[];
		}
	};
}

// =============================================================================
// Helpers
// =============================================================================

function extractPostId(url: string): string {
	// Extract post ID from Twitter/X URL
	const match = url.match(/status\/(\d+)/);
	return match?.[1] ?? url;
}

function priorityToNumber(priority: FaucetInput['priority']): number {
	const map = { low: 0, normal: 1, high: 2, urgent: 3 };
	return map[priority] ?? 1;
}

export type ContentForgeDb = ReturnType<typeof createContentForgeDb>;
