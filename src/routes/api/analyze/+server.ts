/**
 * Server-side API route for Claude goal analysis
 *
 * Keeps API key secure by making Claude calls from the server.
 * Falls back to local analysis if API is unavailable.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

interface AnalysisRequest {
	goal: string;
	context?: {
		availableSkills?: string[];
	};
}

interface ClaudeAnalysis {
	technologies: string[];
	features: string[];
	domains: string[];
	suggestedSkills: string[];
	complexity: 'simple' | 'moderate' | 'complex';
	summary: string;
	questions?: string[];
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const ANALYSIS_PROMPT = `You are analyzing a user's project goal to recommend relevant development skills and technologies.

Given the user's project description, extract:
1. **technologies**: Specific technologies mentioned or implied (e.g., nextjs, react, supabase, stripe)
2. **features**: Features they want to build (e.g., authentication, payments, dashboard, api)
3. **domains**: Business domains (e.g., saas, e-commerce, marketplace, fintech)
4. **suggestedSkills**: Skill IDs that would help (use kebab-case like: nextjs-app-router, supabase-backend, stripe-payments)
5. **complexity**: Is this simple (1-2 skills), moderate (3-5 skills), or complex (6+ skills)?
6. **summary**: A one-sentence summary of what they want to build
7. **questions**: Only if the input is too vague, ask 1-2 clarifying questions

Respond ONLY with valid JSON matching this structure:
{
  "technologies": ["nextjs", "supabase"],
  "features": ["authentication", "dashboard"],
  "domains": ["saas"],
  "suggestedSkills": ["nextjs-app-router", "supabase-auth", "supabase-backend"],
  "complexity": "moderate",
  "summary": "A SaaS dashboard with authentication using Next.js and Supabase",
  "questions": []
}

Available skill IDs to choose from:
{{SKILLS}}

User's project goal:
{{GOAL}}`;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: AnalysisRequest = await request.json();

		if (!body.goal || typeof body.goal !== 'string') {
			return json({ error: 'Goal is required' }, { status: 400 });
		}

		// Check if API key is configured
		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			return json({
				error: 'Claude API not configured',
				fallback: true
			}, { status: 503 });
		}

		// Build the prompt
		const skillsList = body.context?.availableSkills?.slice(0, 100).join(', ') ||
			'nextjs-app-router, react-patterns, supabase-backend, supabase-auth, stripe-payments, tailwind-patterns, typescript-patterns, api-design, authentication-oauth, graphql-schema';

		const prompt = ANALYSIS_PROMPT
			.replace('{{SKILLS}}', skillsList)
			.replace('{{GOAL}}', body.goal);

		// Call Claude API
		const response = await fetch(CLAUDE_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 1024,
				messages: [
					{
						role: 'user',
						content: prompt
					}
				]
			})
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Claude API error:', response.status, errorText);
			return json({
				error: 'Claude API request failed',
				fallback: true
			}, { status: 502 });
		}

		const data = await response.json();

		// Extract the text content
		const textContent = data.content?.find((c: { type: string }) => c.type === 'text');
		if (!textContent?.text) {
			return json({
				error: 'Invalid Claude response',
				fallback: true
			}, { status: 502 });
		}

		// Parse the JSON response
		try {
			const analysis: ClaudeAnalysis = JSON.parse(textContent.text);
			return json({
				success: true,
				analysis,
				source: 'claude'
			});
		} catch (parseError) {
			console.error('Failed to parse Claude response:', textContent.text);
			return json({
				error: 'Failed to parse Claude response',
				fallback: true
			}, { status: 502 });
		}

	} catch (error) {
		console.error('Analysis API error:', error);
		return json({
			error: error instanceof Error ? error.message : 'Internal server error',
			fallback: true
		}, { status: 500 });
	}
};
