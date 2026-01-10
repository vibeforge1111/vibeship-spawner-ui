/**
 * Server-side API route for Claude goal analysis
 *
 * Intelligent PRD-to-skill matching using Claude with full skill context.
 * Claude sees ALL 480 skills organized by domain and selects with reasoning.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import skillIndex from '$lib/data/skill-index-ultra.json';
import { ClaudeApiAnalysisSchema, safeJsonParse } from '$lib/types/schemas';

interface AnalysisRequest {
	goal: string;
	context?: {
		availableSkills?: string[];
	};
}

interface SkillSelection {
	id: string;
	reason: string;
	tier: 1 | 2 | 3; // 1=essential, 2=recommended, 3=helpful
}

interface ClaudeAnalysis {
	technologies: string[];
	features: string[];
	domains: string[];
	suggestedSkills: SkillSelection[];
	complexity: 'simple' | 'moderate' | 'complex';
	summary: string;
	questions?: string[];
	workflowOrder?: string[]; // Suggested execution order
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

const ANALYSIS_PROMPT = `You are an expert software architect analyzing a project description to recommend the most relevant development skills.

## Your Task
Read the project description carefully and select 15-25 skills that are SPECIFICALLY relevant. Think about:
1. What is the project's PRIMARY domain? (game, AI, web app, etc.)
2. What technologies are mentioned or implied?
3. What features need to be built?
4. What supporting skills are needed? (auth, database, deployment)

## CRITICAL Rules
- **Be PRECISE**: A game project needs game-* skills, NOT stripe-integration unless payments are mentioned
- **Be COMPLETE**: Include all essential skills for the project type
- **Be FOCUSED**: Don't add generic skills that aren't relevant
- **Think about HANDOFFS**: Which skill leads to which? Order matters.

## Available Skills (480 total, organized by domain)
{{SKILLS}}

## Response Format
Return ONLY valid JSON:
{
  "technologies": ["tech1", "tech2"],
  "features": ["feature1", "feature2"],
  "domains": ["primary-domain", "secondary-domain"],
  "suggestedSkills": [
    { "id": "skill-id", "reason": "Why this skill is needed", "tier": 1 },
    { "id": "another-skill", "reason": "Specific reason", "tier": 2 }
  ],
  "complexity": "simple|moderate|complex",
  "summary": "One sentence describing what they want to build",
  "workflowOrder": ["skill-1", "skill-2", "skill-3"],
  "questions": []
}

Tier meanings:
- tier 1: Essential - project cannot work without this
- tier 2: Recommended - significantly improves the project
- tier 3: Helpful - nice to have, adds polish

## Project Description
{{GOAL}}`;

/**
 * Format skill index for Claude prompt
 * Groups skills by domain for better context understanding
 */
function formatSkillsForPrompt(): string {
	const lines: string[] = [];

	for (const [domain, skills] of Object.entries(skillIndex)) {
		lines.push(`\n### ${domain.toUpperCase()} (${skills.split(', ').length} skills)`);
		lines.push(skills);
	}

	return lines.join('\n');
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: AnalysisRequest = await request.json();

		if (!body.goal || typeof body.goal !== 'string') {
			return json({ error: 'Goal is required' }, { status: 400 });
		}

		// Check if API key is configured
		const apiKey = env.ANTHROPIC_API_KEY;
		if (!apiKey) {
			// No API key - use local H70 matching (works great!)
			// For intelligent matching, users can paste PRD to Claude Code
			return json({
				error: 'Using local H70 matching (no API key configured)',
				fallback: true,
				hint: 'For intelligent PRD analysis, paste your PRD to Claude Code in the terminal',
				localMatchingAvailable: true
			}, { status: 200 }); // 200 because local matching will work
		}

		// Build the prompt with full skill index
		const skillsFormatted = formatSkillsForPrompt();
		const prompt = ANALYSIS_PROMPT
			.replace('{{SKILLS}}', skillsFormatted)
			.replace('{{GOAL}}', body.goal);

		// Call Claude API with extended token limit for complex analysis
		const response = await fetch(CLAUDE_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: 'claude-sonnet-4-20250514',
				max_tokens: 2048, // Increased for detailed skill reasoning
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
			// Handle potential markdown code blocks in response
			let jsonText = textContent.text.trim();
			if (jsonText.startsWith('```json')) {
				jsonText = jsonText.slice(7);
			}
			if (jsonText.startsWith('```')) {
				jsonText = jsonText.slice(3);
			}
			if (jsonText.endsWith('```')) {
				jsonText = jsonText.slice(0, -3);
			}
			jsonText = jsonText.trim();

			// SECURITY: Validate JSON with Zod schema
			const parsed = safeJsonParse(jsonText, ClaudeApiAnalysisSchema, 'claude-analysis');
			if (!parsed) {
				console.error('Failed to validate Claude response:', jsonText.slice(0, 500));
				return json({
					error: 'Invalid analysis response format',
					fallback: true
				}, { status: 502 });
			}
			const analysis: ClaudeAnalysis = parsed as ClaudeAnalysis;

			// Validate skill selections
			if (analysis.suggestedSkills && Array.isArray(analysis.suggestedSkills)) {
				// Normalize skill selections (handle both old string[] and new object[] format)
				analysis.suggestedSkills = analysis.suggestedSkills.map((skill: unknown) => {
					if (typeof skill === 'string') {
						return { id: skill, reason: 'Selected by Claude', tier: 2 as const };
					}
					return skill as SkillSelection;
				});
			}

			return json({
				success: true,
				analysis,
				source: 'claude',
				skillCount: analysis.suggestedSkills?.length || 0
			});
		} catch (parseError) {
			console.error('Failed to parse Claude response:', textContent.text);
			return json({
				error: 'Failed to parse Claude response',
				fallback: true,
				rawResponse: textContent.text.slice(0, 500) // For debugging
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
