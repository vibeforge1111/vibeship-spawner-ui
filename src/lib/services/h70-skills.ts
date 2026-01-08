/**
 * H70 Skills Service
 *
 * Reads skills directly from the local vibeship-h70 skill-lab directory.
 * This is the PRIMARY source for skill content in spawner-ui.
 */

import { browser } from '$app/environment';

// H70 skill-lab path (configured via environment or default)
const H70_SKILL_LAB_PATH = 'C:/Users/USER/Desktop/vibeship-h70/skill-lab';

export interface H70Skill {
	id: string;
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

export interface H70SkillContent {
	skill: H70Skill;
	rawYaml: string;
	formattedContent: string;
}

/**
 * Format H70 skill into comprehensive instructions for Claude Code
 */
export function formatH70SkillContent(skill: H70Skill, rawYaml: string): string {
	const lines: string[] = [];

	// Header
	lines.push(`# ${skill.name}`);
	lines.push('');
	lines.push(`> ${skill.description}`);
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
			lines.push(`### ❌ ${ap.name}`);
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
			lines.push(`### ✅ ${p.name}`);
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
 * Fetch H70 skill content via API (browser-side)
 */
export async function getH70Skill(skillId: string): Promise<H70SkillContent | null> {
	if (!browser) return null;

	try {
		const response = await fetch(`/api/h70-skills/${skillId}`);
		if (!response.ok) {
			console.warn(`[H70] Skill not found: ${skillId}`);
			return null;
		}

		const data = await response.json();
		return data as H70SkillContent;
	} catch (e) {
		console.error(`[H70] Error fetching skill ${skillId}:`, e);
		return null;
	}
}

/**
 * Check if H70 skill exists
 */
export async function h70SkillExists(skillId: string): Promise<boolean> {
	if (!browser) return false;

	try {
		const response = await fetch(`/api/h70-skills/${skillId}`, { method: 'HEAD' });
		return response.ok;
	} catch {
		return false;
	}
}

/**
 * Get the local H70 skill-lab path
 */
export function getH70SkillLabPath(): string {
	return H70_SKILL_LAB_PATH;
}
