/**
 * ContentForge Bridge - Write Endpoint
 *
 * POST /api/contentforge/bridge/write
 * Writes content to a file for Claude Code to analyze.
 *
 * IMPORTANT: This endpoint bundles ALL 8 H70 skills with every request
 * so that the worker always has access to them without needing to fetch.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as yaml from 'yaml';

const SPAWNER_DIR = '.spawner';
const CONTENT_FILE = 'pending-contentforge.md';
const REQUEST_FILE = 'pending-contentforge-request.json';
const H70_SKILL_LAB_PATH = 'C:/Users/USER/Desktop/vibeship-h70/skill-lab';

// All 8 H70 skills required for ContentForge analysis
const CONTENTFORGE_SKILLS = [
	'viral-marketing',
	'copywriting',
	'viral-hooks',
	'content-strategy',
	'persuasion-psychology',
	'platform-algorithms',
	'audience-psychology',
	'narrative-craft'
];

interface H70Skill {
	name: string;
	description: string;
	identity?: string;
	owns?: string[];
	disasters?: Array<{ title: string; story: string; lesson: string }>;
	anti_patterns?: Array<{ name: string; why_bad: string; instead: string }>;
	patterns?: Array<{ name: string; when: string; implementation: string; gotchas?: string[] }>;
	triggers?: string[];
}

/**
 * Load a single H70 skill from disk
 */
async function loadH70Skill(skillId: string): Promise<{ id: string; skill: H70Skill; formatted: string } | null> {
	const skillPath = path.join(H70_SKILL_LAB_PATH, skillId, 'skill.yaml');

	if (!existsSync(skillPath)) {
		console.warn(`[ContentForge] H70 skill not found: ${skillId}`);
		return null;
	}

	try {
		const rawYaml = await readFile(skillPath, 'utf-8');
		const skill = yaml.parse(rawYaml) as H70Skill;

		// Format for easy reading
		const lines: string[] = [];
		lines.push(`## ${skill.name}`);
		lines.push(`> ${skill.description}`);
		lines.push('');

		if (skill.identity) {
			lines.push('### Identity');
			lines.push(skill.identity.trim());
			lines.push('');
		}

		if (skill.owns && skill.owns.length > 0) {
			lines.push('### Expertise');
			skill.owns.forEach(own => lines.push(`- ${own}`));
			lines.push('');
		}

		if (skill.disasters && skill.disasters.length > 0) {
			lines.push('### Critical Lessons');
			skill.disasters.slice(0, 3).forEach(d => {
				lines.push(`- **${d.title}**: ${d.lesson}`);
			});
			lines.push('');
		}

		if (skill.anti_patterns && skill.anti_patterns.length > 0) {
			lines.push('### Avoid');
			skill.anti_patterns.slice(0, 3).forEach(ap => {
				lines.push(`- **${ap.name}**: ${ap.why_bad}. Instead: ${ap.instead}`);
			});
			lines.push('');
		}

		if (skill.patterns && skill.patterns.length > 0) {
			lines.push('### Key Patterns');
			skill.patterns.slice(0, 3).forEach(p => {
				lines.push(`- **${p.name}** (${p.when})`);
			});
			lines.push('');
		}

		return {
			id: skillId,
			skill,
			formatted: lines.join('\n')
		};
	} catch (e) {
		console.error(`[ContentForge] Error loading skill ${skillId}:`, e);
		return null;
	}
}

/**
 * Load all ContentForge H70 skills
 */
async function loadAllSkills(): Promise<string> {
	const results = await Promise.all(CONTENTFORGE_SKILLS.map(loadH70Skill));
	const loaded = results.filter(Boolean) as Array<{ id: string; skill: H70Skill; formatted: string }>;

	if (loaded.length === 0) {
		return '> No H70 skills could be loaded. Check the skill-lab path.';
	}

	const lines: string[] = [];
	lines.push('# H70 Skills Reference');
	lines.push('');
	lines.push(`Loaded ${loaded.length}/${CONTENTFORGE_SKILLS.length} skills for analysis.`);
	lines.push('');

	// Group by agent
	const agentSkills: Record<string, string[]> = {
		'Marketing Agent': ['viral-marketing', 'marketing', 'platform-algorithms'],
		'Copywriting Agent': ['copywriting', 'viral-hooks', 'narrative-craft'],
		'Research Agent': ['content-strategy', 'audience-psychology'],
		'Psychology Agent': ['viral-hooks', 'persuasion-psychology', 'audience-psychology']
	};

	for (const [agent, skillIds] of Object.entries(agentSkills)) {
		lines.push(`---`);
		lines.push(`# ${agent}`);
		lines.push('');

		for (const skillId of skillIds) {
			const skill = loaded.find(s => s.id === skillId);
			if (skill) {
				lines.push(skill.formatted);
			}
		}
	}

	return lines.join('\n');
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { content, requestId } = await request.json();

		if (!content || !requestId) {
			return json({ error: 'content and requestId are required' }, { status: 400 });
		}

		// Ensure .spawner directory exists
		const spawnerPath = path.resolve(process.cwd(), SPAWNER_DIR);
		if (!existsSync(spawnerPath)) {
			await mkdir(spawnerPath, { recursive: true });
		}

		// Load all H70 skills
		console.log(`[ContentForge Bridge] Loading H70 skills for request: ${requestId}`);
		const skillsContent = await loadAllSkills();

		// Build the comprehensive analysis file
		const analysisContent = `# ContentForge Analysis Request

**Request ID:** ${requestId}
**Timestamp:** ${new Date().toISOString()}

---

# Content to Analyze

${content}

---

${skillsContent}

---

# Analysis Instructions

Use the H70 skills above to analyze the content as 4 specialized agents:

1. **Marketing Agent** - Apply STEPPS framework, K-Factor analysis, platform-algorithms
2. **Copywriting Agent** - Apply Hook formulas, 4 U's, PAS/AIDA, narrative-craft
3. **Research Agent** - Analyze trends, platform fit, audience-psychology
4. **Psychology Agent** - Apply persuasion-psychology, emotional triggers, identity resonance

Then synthesize into:
- Virality Score (0-100)
- Key Insights (3-5 bullets)
- Playbook with actionable steps

Send response to: POST http://localhost:5174/api/events
With type: "contentforge_analysis_complete"
`;

		// Write content file with bundled skills
		const contentPath = path.join(spawnerPath, CONTENT_FILE);
		await writeFile(contentPath, analysisContent, 'utf-8');

		// Write request metadata
		const requestPath = path.join(spawnerPath, REQUEST_FILE);
		const requestData = {
			requestId,
			timestamp: new Date().toISOString(),
			contentPath,
			skillsLoaded: CONTENTFORGE_SKILLS,
			status: 'pending'
		};
		await writeFile(requestPath, JSON.stringify(requestData, null, 2), 'utf-8');

		console.log(`[ContentForge Bridge] Written content + ${CONTENTFORGE_SKILLS.length} H70 skills for analysis: ${requestId}`);

		return json({
			success: true,
			path: contentPath,
			requestId,
			skillsLoaded: CONTENTFORGE_SKILLS.length
		});

	} catch (error) {
		console.error('[ContentForge Bridge] Write error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to write content' },
			{ status: 500 }
		);
	}
};
