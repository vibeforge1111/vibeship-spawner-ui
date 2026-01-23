// Teams API Endpoint
// Serves agentic team configurations
// Configure your teams in: src/lib/data/teams/index.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { registeredTeams, defaultActiveTeamId } from '$lib/data/teams';

export const GET: RequestHandler = async () => {
	return json({
		teams: registeredTeams,
		active_team_id: defaultActiveTeamId
	});
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { action, team_id, agent_id } = body;

	// Find the requested team
	const team = team_id
		? registeredTeams.find(t => t.id === team_id)
		: registeredTeams.find(t => t.id === defaultActiveTeamId);

	if (!team) {
		return json({ success: false, error: 'Team not found' }, { status: 404 });
	}

	switch (action) {
		case 'get_agent':
			// Find agent across all divisions
			for (const division of Object.values(team.divisions)) {
				const agent = division.agents.find(a => a.id === agent_id);
				if (agent) {
					return json({ success: true, agent });
				}
			}
			return json({ success: false, error: 'Agent not found' }, { status: 404 });

		case 'get_division':
			const division = team.divisions[body.division_id];
			if (division) {
				return json({ success: true, division });
			}
			return json({ success: false, error: 'Division not found' }, { status: 404 });

		case 'list_teams':
			return json({
				success: true,
				teams: registeredTeams.map(t => ({ id: t.id, name: t.name, description: t.description }))
			});

		default:
			return json({ success: false, error: 'Unknown action' }, { status: 400 });
	}
};
