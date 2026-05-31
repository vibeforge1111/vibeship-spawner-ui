// Teams API Endpoint
// Serves agentic team configurations
// Configure your teams in: src/lib/data/teams/index.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { AgenticTeam } from '$lib/types/teams';
import { registeredTeams, defaultActiveTeamId } from '$lib/data/teams';

import { promises as fs } from 'node:fs';
import path from 'node:path';

const TEAM_REPO_TEAMS_DIR_FALLBACKS = [
	path.resolve(process.cwd(), 'teams'),
	path.resolve(process.cwd(), '..', 'teams')
];

async function isDirectory(dir: string): Promise<boolean> {
	try {
		const stat = await fs.stat(dir);
		return stat.isDirectory();
	} catch {
		return false;
	}
}

async function resolveTeamsDir(): Promise<string | null> {
	const configuredDir = process.env.SPAWNER_TEAMS_DIR || process.env.TEAM_REPO_TEAMS_DIR;

	if (configuredDir) {
		const resolvedDir = path.resolve(configuredDir);
		if (await isDirectory(resolvedDir)) {
			return resolvedDir;
		}

		console.warn(`[Teams API] Configured teams directory not found: ${resolvedDir}`);
		return null;
	}

	for (const candidate of TEAM_REPO_TEAMS_DIR_FALLBACKS) {
		if (await isDirectory(candidate)) {
			return candidate;
		}
	}

	return null;
}

async function loadTeamsFromDir(dir: string): Promise<AgenticTeam[]> {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const files = entries
			.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.json'))
			.map((e) => path.join(dir, e.name));

		const teams: AgenticTeam[] = [];
		for (const file of files) {
			try {
				const raw = await fs.readFile(file, 'utf8');
				const parsed = JSON.parse(raw) as AgenticTeam;
				// Minimal sanity checks to avoid crashing the UI on bad JSON.
				if (!parsed || typeof parsed !== 'object') continue;
				if (!parsed.id || !parsed.name || !parsed.divisions) continue;
				teams.push(parsed);
			} catch {
				// Ignore invalid team files.
			}
		}

		teams.sort((a, b) => a.name.localeCompare(b.name));
		return teams;
	} catch {
		return [];
	}
}

async function getTeamRegistry(): Promise<{ teams: AgenticTeam[]; active_team_id: string | null }> {
	const teamsDir = await resolveTeamsDir();
	const diskTeams = teamsDir ? await loadTeamsFromDir(teamsDir) : [];
	const teams = diskTeams.length > 0 ? diskTeams : registeredTeams;

	const activeFromEnv = process.env.SPAWNER_ACTIVE_TEAM_ID || process.env.SPAWNER_DEFAULT_TEAM_ID;
	const desiredActive = activeFromEnv || defaultActiveTeamId;
	const active_team_id = teams.some((t) => t.id === desiredActive) ? desiredActive : teams[0]?.id || null;

	return { teams, active_team_id };
}

export const GET: RequestHandler = async () => {
	const registry = await getTeamRegistry();
	return json(registry);
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
	}
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		return json({ success: false, error: 'Invalid request body' }, { status: 400 });
	}
	const { action, team_id, agent_id } = body as Record<string, unknown>;
	if (typeof action !== 'string' || !action.trim()) {
		return json({ success: false, error: 'Missing action' }, { status: 400 });
	}

	const { teams, active_team_id } = await getTeamRegistry();

	// Find the requested team
	const defaultId = active_team_id || defaultActiveTeamId;
	const requestedTeamId = typeof team_id === 'string' && team_id.trim() ? team_id.trim() : null;
	const team = requestedTeamId ? teams.find((t) => t.id === requestedTeamId) : teams.find((t) => t.id === defaultId);

	if (!team) {
		return json({ success: false, error: 'Team not found' }, { status: 404 });
	}

	switch (action) {
		case 'get_agent':
			// Find agent across all divisions
			for (const division of Object.values(team.divisions)) {
				const agentId = typeof agent_id === 'string' ? agent_id : '';
				const agent = division.agents.find((a) => a.id === agentId);
				if (agent) {
					return json({ success: true, agent });
				}
			}
			return json({ success: false, error: 'Agent not found' }, { status: 404 });

		case 'get_division':
			const divisionId = (body as Record<string, unknown>).division_id;
			if (typeof divisionId !== 'string' || !divisionId.trim()) {
				return json({ success: false, error: 'Missing division_id' }, { status: 400 });
			}
			const division = team.divisions[divisionId];
			if (division) {
				return json({ success: true, division });
			}
			return json({ success: false, error: 'Division not found' }, { status: 404 });

		case 'list_teams':
			return json({
				success: true,
				teams: teams.map((t) => ({ id: t.id, name: t.name, description: t.description }))
			});

		default:
			return json({ success: false, error: 'Unknown action' }, { status: 400 });
	}
};
