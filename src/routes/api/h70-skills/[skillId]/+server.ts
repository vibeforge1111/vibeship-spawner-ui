/**
 * H70 Skills API Route
 *
 * Serves skill content directly from the local vibeship-h70 skill-lab.
 * GET /api/h70-skills/[skillId] - Get skill content
 * HEAD /api/h70-skills/[skillId] - Check if skill exists
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

// Vibeship Skills Lab path (new flat YAML structure)
const SKILLS_LAB_PATH = 'C:/Users/USER/Desktop/vibeship-skills-lab';

// Categories to search for skills
const SKILL_CATEGORIES = [
	'ai', 'ai-agents', 'ai-tools', 'analytics', 'architecture', 'backend', 'benchmarks',
	'biotech', 'blockchain', 'business', 'cli', 'climate', 'communications', 'community',
	'compliance', 'creative', 'data', 'data-science', 'design', 'development', 'devops',
	'ecommerce', 'education', 'engineering', 'enterprise', 'finance', 'founder', 'frameworks',
	'frontend', 'gamedev', 'game-dev', 'game-dev-llm', 'hardware', 'infrastructure',
	'integration', 'integrations', 'legal', 'maker', 'marketing', 'mcp', 'mcp-server',
	'mind', 'mobile', 'nocode', 'performance', 'product', 'productivity', 'robotics',
	'science', 'security', 'simulation', 'space', 'startup', 'strategy', 'support',
	'testing', 'trading', 'web3'
];

interface H70Skill {
	name: string;
	description: string;
	version?: string;
	identity?: string;
	owns?: string[];
	delegates?: Array<{ skill: string; when: string }>;
	disasters?: Array<{ title: string; story: string; lesson: string }>;
	anti_patterns?: Array<{ name: string; why_bad: string; instead: string; code_smell?: string }>;
	patterns?: Array<{ name: string; when: string; implementation: string; gotchas?: string[] }>;
	triggers?: string[];
	tags?: string[];
}

function formatH70SkillContent(skill: H70Skill & { id: string }, rawYaml: string): string {
	const lines: string[] = [];

	// Header
	lines.push(`# ${skill.name}`);
	lines.push('');
	lines.push(`> ${skill.description}`);
	lines.push('');
	lines.push(`**Skill ID:** ${skill.id}`);
	lines.push(`**Source:** H70 Skill Lab (Local)`);
	lines.push('');

	// Identity (the expert persona)
	if (skill.identity) {
		lines.push('## Identity');
		lines.push('');
		lines.push(skill.identity.trim());
		lines.push('');
	}

	// What this skill owns/handles
	if (skill.owns && skill.owns.length > 0) {
		lines.push('## Expertise Areas');
		lines.push('');
		skill.owns.forEach(own => {
			lines.push(`- ${own}`);
		});
		lines.push('');
	}

	// Delegates (when to hand off to other skills)
	if (skill.delegates && skill.delegates.length > 0) {
		lines.push('## When to Delegate');
		lines.push('');
		skill.delegates.forEach(d => {
			lines.push(`- **${d.skill}**: ${d.when}`);
		});
		lines.push('');
	}

	// Disasters (war stories and lessons)
	if (skill.disasters && skill.disasters.length > 0) {
		lines.push('## Critical Lessons (From Real Disasters)');
		lines.push('');
		skill.disasters.forEach((disaster, i) => {
			lines.push(`### ${i + 1}. ${disaster.title}`);
			lines.push('');
			lines.push(`**What happened:** ${disaster.story}`);
			lines.push('');
			lines.push(`**Lesson:** ${disaster.lesson}`);
			lines.push('');
		});
	}

	// Anti-patterns
	if (skill.anti_patterns && skill.anti_patterns.length > 0) {
		lines.push('## Anti-Patterns to Avoid');
		lines.push('');
		skill.anti_patterns.forEach(ap => {
			lines.push(`### ${ap.name}`);
			lines.push('');
			lines.push(`**Why it's bad:** ${ap.why_bad}`);
			lines.push('');
			lines.push(`**Instead:** ${ap.instead}`);
			if (ap.code_smell) {
				lines.push('');
				lines.push(`**Code smell:** \`${ap.code_smell}\``);
			}
			lines.push('');
		});
	}

	// Patterns
	if (skill.patterns && skill.patterns.length > 0) {
		lines.push('## Recommended Patterns');
		lines.push('');
		skill.patterns.forEach(p => {
			lines.push(`### ${p.name}`);
			lines.push('');
			lines.push(`**When:** ${p.when}`);
			lines.push('');
			lines.push('**Implementation:**');
			lines.push('');
			lines.push(p.implementation);
			if (p.gotchas && p.gotchas.length > 0) {
				lines.push('');
				lines.push('**Gotchas:**');
				p.gotchas.forEach(g => lines.push(`- ${g}`));
			}
			lines.push('');
		});
	}

	// Triggers
	if (skill.triggers && skill.triggers.length > 0) {
		lines.push('## Activation Triggers');
		lines.push('');
		lines.push(`This skill activates on: ${skill.triggers.join(', ')}`);
		lines.push('');
	}

	// Tags
	if (skill.tags && skill.tags.length > 0) {
		lines.push('---');
		lines.push(`**Tags:** ${skill.tags.join(', ')}`);
	}

	return lines.join('\n');
}

/**
 * Find skill file across all categories
 * New format: {SKILLS_LAB_PATH}/{category}/{skillId}.yaml
 */
function findSkillPath(skillId: string): string | null {
	// Try exact match first
	for (const category of SKILL_CATEGORIES) {
		const skillPath = path.join(SKILLS_LAB_PATH, category, `${skillId}.yaml`);
		if (fs.existsSync(skillPath)) {
			return skillPath;
		}
	}

	// Try with common name variations (e.g., supabase-backend vs supabase_backend)
	const variations = [
		skillId,
		skillId.replace(/-/g, '_'),
		skillId.replace(/_/g, '-'),
		skillId.toLowerCase(),
		skillId.replace(/specialist$/i, ''),
		skillId.replace(/-specialist$/i, ''),
	];

	for (const variant of variations) {
		for (const category of SKILL_CATEGORIES) {
			const skillPath = path.join(SKILLS_LAB_PATH, category, `${variant}.yaml`);
			if (fs.existsSync(skillPath)) {
				return skillPath;
			}
		}
	}

	return null;
}

export const GET: RequestHandler = async ({ params }) => {
	const { skillId } = params;

	if (!skillId) {
		throw error(400, 'Skill ID is required');
	}

	// Find skill across categories
	const skillPath = findSkillPath(skillId);

	// Check if skill exists
	if (!skillPath) {
		throw error(404, `Skill not found: ${skillId}`);
	}

	try {
		// Read and parse the skill YAML
		const rawYaml = fs.readFileSync(skillPath, 'utf-8');
		const skill = yaml.parse(rawYaml) as H70Skill;

		// Extract category from path
		const pathParts = skillPath.split(/[/\\]/);
		const category = pathParts[pathParts.length - 2];

		// Add ID from filename (without .yaml)
		const skillWithId = {
			...skill,
			id: skillId,
			category
		};

		// Format the content for Claude Code
		const formattedContent = formatH70SkillContent(skillWithId, rawYaml);

		return json({
			skill: skillWithId,
			rawYaml,
			formattedContent,
			source: 'vibeship-skills-lab',
			path: skillPath,
			category
		});
	} catch (e) {
		console.error(`[Skills API] Error reading skill ${skillId}:`, e);
		throw error(500, `Failed to read skill: ${skillId}`);
	}
};

export const HEAD: RequestHandler = async ({ params }) => {
	const { skillId } = params;

	if (!skillId) {
		throw error(400, 'Skill ID is required');
	}

	const skillPath = findSkillPath(skillId);

	if (!skillPath) {
		throw error(404, `Skill not found: ${skillId}`);
	}

	return new Response(null, { status: 200 });
};
