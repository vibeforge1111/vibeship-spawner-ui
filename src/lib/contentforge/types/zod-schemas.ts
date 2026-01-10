/**
 * ContentForge Zod Schemas
 *
 * Runtime validation for external data.
 * TypeScript strict mode: Never trust external input.
 */

import { z } from 'zod';

// =============================================================================
// Input Validation
// =============================================================================

export const FaucetInputSchema = z.object({
	url: z.string().url(),
	options: z.object({
		scrapeReplies: z.boolean().optional(),
		maxDepth: z.number().int().positive().optional(),
		includeQuotes: z.boolean().optional()
	}).strip().optional()
}).strip();

// =============================================================================
// API Response Validation
// =============================================================================

export const EngagementMetricsSchema = z.object({
	likes: z.coerce.number().int().nonnegative(),
	retweets: z.coerce.number().int().nonnegative(),
	replies: z.coerce.number().int().nonnegative(),
	bookmarks: z.coerce.number().int().nonnegative(),
	views: z.coerce.number().int().nonnegative(),
	engagementRate: z.coerce.number().nonnegative()
});

export const AuthorInfoSchema = z.object({
	username: z.string().min(1).max(50),
	displayName: z.string(),
	followers: z.number().int().nonnegative(),
	verified: z.boolean(),
	bio: z.string().max(500).optional(),
	profileImageUrl: z.string().url().optional()
});

export const MediaItemSchema = z.object({
	type: z.enum(['image', 'video', 'gif']),
	url: z.string().url(),
	altText: z.string().max(500).optional(),
	duration: z.number().positive().optional()
});

export const ContentInfoSchema = z.object({
	text: z.string().max(25000),
	media: z.array(MediaItemSchema).max(10),
	hashtags: z.array(z.string()).max(30),
	mentions: z.array(z.string()).max(50),
	threadLength: z.number().int().positive()
});

export const ScrapedDataSchema = z.object({
	postId: z.string().min(1),
	url: z.string().url(),
	author: AuthorInfoSchema,
	content: ContentInfoSchema,
	metrics: EngagementMetricsSchema,
	temporal: z.object({
		postedAt: z.string().datetime(),
		scrapedAt: z.string().datetime()
	})
});

// =============================================================================
// Agent Output Validation
// =============================================================================

// Generic AgentOutput schema factory
export const createAgentOutputSchema = <T extends z.ZodType>(dataSchema: T) =>
	z.object({
		agentType: z.enum(['marketing', 'copywriting', 'research', 'psychology']),
		success: z.boolean(),
		error: z.string().optional(),
		data: dataSchema,
		confidence: z.number().min(0).max(1),
		processingTimeMs: z.number().nonnegative()
	});

// Simple AgentOutput schema for validation tests
export const AgentOutputSchema = z.object({
	agentType: z.enum(['marketing', 'copywriting', 'research', 'psychology']),
	success: z.boolean(),
	error: z.string().optional(),
	data: z.unknown(),
	confidence: z.number().min(0).max(1),
	processingTimeMs: z.number().nonnegative()
});

// =============================================================================
// Type Exports (inferred from schemas)
// =============================================================================

export type FaucetInput = z.infer<typeof FaucetInputSchema>;
export type ValidatedFaucetInput = z.infer<typeof FaucetInputSchema>;
export type ValidatedScrapedData = z.infer<typeof ScrapedDataSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

export function validateFaucetInput(input: unknown): ValidatedFaucetInput {
	return FaucetInputSchema.parse(input);
}

export function validateScrapedData(data: unknown): ValidatedScrapedData {
	return ScrapedDataSchema.parse(data);
}

export function safeParseFaucetInput(input: unknown) {
	return FaucetInputSchema.safeParse(input);
}

export function safeParseScrapedData(data: unknown) {
	return ScrapedDataSchema.safeParse(data);
}
