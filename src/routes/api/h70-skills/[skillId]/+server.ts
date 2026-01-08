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

// H70 skill-lab path
const H70_SKILL_LAB_PATH = 'C:/Users/USER/Desktop/vibeship-h70/skill-lab';

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

export const GET: RequestHandler = async ({ params }) => {
	const { skillId } = params;

	if (!skillId) {
		throw error(400, 'Skill ID is required');
	}

	const skillPath = path.join(H70_SKILL_LAB_PATH, skillId, 'skill.yaml');

	// Check if skill exists
	if (!fs.existsSync(skillPath)) {
		throw error(404, `H70 skill not found: ${skillId}`);
	}

	try {
		// Read and parse the skill YAML
		const rawYaml = fs.readFileSync(skillPath, 'utf-8');
		const skill = yaml.parse(rawYaml) as H70Skill;

		// Add ID from folder name
		const skillWithId = { ...skill, id: skillId };

		// Format the content for Claude Code
		const formattedContent = formatH70SkillContent(skillWithId, rawYaml);

		return json({
			skill: skillWithId,
			rawYaml,
			formattedContent,
			source: 'h70-local',
			path: skillPath
		});
	} catch (e) {
		console.error(`[H70 API] Error reading skill ${skillId}:`, e);
		throw error(500, `Failed to read H70 skill: ${skillId}`);
	}
};

export const HEAD: RequestHandler = async ({ params }) => {
	const { skillId } = params;

	if (!skillId) {
		throw error(400, 'Skill ID is required');
	}

	const skillPath = path.join(H70_SKILL_LAB_PATH, skillId, 'skill.yaml');

	if (!fs.existsSync(skillPath)) {
		throw error(404, `H70 skill not found: ${skillId}`);
	}

	return new Response(null, { status: 200 });
};
