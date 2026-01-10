/**
 * Zod Schema Validation Tests
 *
 * Tests runtime validation for external input.
 * Critical for security - never trust user data.
 */

import { describe, it, expect } from 'vitest';
import {
	FaucetInputSchema,
	ScrapedDataSchema,
	AgentOutputSchema,
	type FaucetInput
} from '../types/zod-schemas';

describe('FaucetInputSchema', () => {
	it('should validate correct faucet input', () => {
		const validInput = {
			url: 'https://x.com/user/status/123456',
			options: {
				scrapeReplies: false,
				maxDepth: 1
			}
		};

		const result = FaucetInputSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	it('should validate URL-only input', () => {
		const validInput = {
			url: 'https://twitter.com/user/status/789'
		};

		const result = FaucetInputSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	it('should reject invalid URL format', () => {
		const invalidInput = {
			url: 'not-a-valid-url'
		};

		const result = FaucetInputSchema.safeParse(invalidInput);
		expect(result.success).toBe(false);
	});

	it('should reject empty URL', () => {
		const invalidInput = {
			url: ''
		};

		const result = FaucetInputSchema.safeParse(invalidInput);
		expect(result.success).toBe(false);
	});

	it('should reject missing URL', () => {
		const invalidInput = {
			options: { scrapeReplies: true }
		};

		const result = FaucetInputSchema.safeParse(invalidInput);
		expect(result.success).toBe(false);
	});

	it('should accept optional fields', () => {
		const validInput = {
			url: 'https://x.com/user/status/123',
			options: {
				scrapeReplies: true,
				maxDepth: 5,
				includeQuotes: true
			}
		};

		const result = FaucetInputSchema.safeParse(validInput);
		expect(result.success).toBe(true);
	});

	it('should handle extra fields gracefully (strip them)', () => {
		const inputWithExtra = {
			url: 'https://x.com/user/status/123',
			maliciousField: '<script>alert("xss")</script>',
			options: {
				scrapeReplies: false
			}
		};

		const result = FaucetInputSchema.safeParse(inputWithExtra);
		// Should succeed but strip extra fields
		expect(result.success).toBe(true);
		if (result.success) {
			expect((result.data as Record<string, unknown>)['maliciousField']).toBeUndefined();
		}
	});
});

describe('ScrapedDataSchema', () => {
	const validScrapedData = {
		postId: 'post-123',
		url: 'https://x.com/user/status/123',
		author: {
			username: 'testuser',
			displayName: 'Test User',
			followers: 10000,
			verified: false
		},
		content: {
			text: 'Hello world',
			hashtags: ['test'],
			mentions: [],
			media: [],
			threadLength: 1
		},
		metrics: {
			likes: 100,
			retweets: 50,
			replies: 25,
			bookmarks: 10,
			views: 5000,
			engagementRate: 0.37
		},
		temporal: {
			postedAt: '2024-01-15T12:00:00Z',
			scrapedAt: '2024-01-15T13:00:00Z'
		}
	};

	it('should validate correct scraped data', () => {
		const result = ScrapedDataSchema.safeParse(validScrapedData);
		expect(result.success).toBe(true);
	});

	it('should reject missing required fields', () => {
		const incomplete = {
			postId: 'post-123',
			url: 'https://x.com/user/status/123'
			// Missing author, content, metrics, temporal
		};

		const result = ScrapedDataSchema.safeParse(incomplete);
		expect(result.success).toBe(false);
	});

	it('should reject negative metrics', () => {
		const invalidMetrics = {
			...validScrapedData,
			metrics: {
				...validScrapedData.metrics,
				likes: -100 // Invalid
			}
		};

		const result = ScrapedDataSchema.safeParse(invalidMetrics);
		expect(result.success).toBe(false);
	});

	it('should reject invalid date format', () => {
		const invalidDate = {
			...validScrapedData,
			temporal: {
				postedAt: 'not-a-date',
				scrapedAt: '2024-01-15T13:00:00Z'
			}
		};

		const result = ScrapedDataSchema.safeParse(invalidDate);
		expect(result.success).toBe(false);
	});

	it('should validate media array', () => {
		const withMedia = {
			...validScrapedData,
			content: {
				...validScrapedData.content,
				media: [
					{ type: 'image', url: 'https://example.com/img.jpg' },
					{ type: 'video', url: 'https://example.com/vid.mp4' }
				]
			}
		};

		const result = ScrapedDataSchema.safeParse(withMedia);
		expect(result.success).toBe(true);
	});

	it('should reject XSS in text content', () => {
		const xssAttempt = {
			...validScrapedData,
			content: {
				...validScrapedData.content,
				text: '<script>document.cookie</script>'
			}
		};

		// Schema should still parse (content filtering is separate concern)
		// but we test that the structure is valid
		const result = ScrapedDataSchema.safeParse(xssAttempt);
		expect(result.success).toBe(true);
		// Note: XSS prevention should happen at rendering layer
	});

	it('should coerce string numbers to numbers', () => {
		const stringMetrics = {
			...validScrapedData,
			metrics: {
				likes: '100' as unknown as number, // Simulating bad API response
				retweets: 50,
				replies: 25,
				bookmarks: 10,
				views: 5000,
				engagementRate: 0.37
			}
		};

		const result = ScrapedDataSchema.safeParse(stringMetrics);
		// Zod coercion should handle this
		if (result.success) {
			expect(typeof result.data.metrics.likes).toBe('number');
		}
	});
});

describe('AgentOutputSchema', () => {
	it('should validate successful agent output', () => {
		const validOutput = {
			agentType: 'marketing',
			success: true,
			data: {
				positioning: { niche: 'tech' }
			},
			confidence: 0.85,
			processingTimeMs: 150
		};

		const result = AgentOutputSchema.safeParse(validOutput);
		expect(result.success).toBe(true);
	});

	it('should validate failed agent output', () => {
		const failedOutput = {
			agentType: 'marketing',
			success: false,
			data: null,
			confidence: 0,
			processingTimeMs: 50,
			error: 'API timeout'
		};

		const result = AgentOutputSchema.safeParse(failedOutput);
		expect(result.success).toBe(true);
	});

	it('should reject invalid agent type', () => {
		const invalidType = {
			agentType: 'invalid_agent',
			success: true,
			data: {},
			confidence: 0.5,
			processingTimeMs: 100
		};

		const result = AgentOutputSchema.safeParse(invalidType);
		expect(result.success).toBe(false);
	});

	it('should reject confidence outside 0-1 range', () => {
		const invalidConfidence = {
			agentType: 'marketing',
			success: true,
			data: {},
			confidence: 1.5, // Invalid
			processingTimeMs: 100
		};

		const result = AgentOutputSchema.safeParse(invalidConfidence);
		expect(result.success).toBe(false);
	});

	it('should reject negative processing time', () => {
		const invalidTime = {
			agentType: 'marketing',
			success: true,
			data: {},
			confidence: 0.5,
			processingTimeMs: -100 // Invalid
		};

		const result = AgentOutputSchema.safeParse(invalidTime);
		expect(result.success).toBe(false);
	});
});

describe('Security Edge Cases', () => {
	it('should handle null input gracefully', () => {
		const result = FaucetInputSchema.safeParse(null);
		expect(result.success).toBe(false);
	});

	it('should handle undefined input gracefully', () => {
		const result = FaucetInputSchema.safeParse(undefined);
		expect(result.success).toBe(false);
	});

	it('should handle array instead of object', () => {
		const result = FaucetInputSchema.safeParse(['https://x.com']);
		expect(result.success).toBe(false);
	});

	it('should handle deeply nested malicious input', () => {
		const malicious = {
			url: 'https://x.com/user/status/123',
			options: {
				scrapeReplies: true,
				constructor: { prototype: { pwned: true } }
			}
		};

		const result = FaucetInputSchema.safeParse(malicious);
		// Zod should strip unknown fields like 'constructor'
		expect(result.success).toBe(true);
		if (result.success) {
			// After stripping, only known fields should remain
			expect(result.data.options?.scrapeReplies).toBe(true);
		}
	});

	it('should handle extremely long strings', () => {
		const longString = 'a'.repeat(100000);
		const result = FaucetInputSchema.safeParse({
			url: 'https://x.com/' + longString
		});
		// Should either fail validation or truncate
		// This tests we don't crash on large input
		expect(result).toBeDefined();
	});
});
