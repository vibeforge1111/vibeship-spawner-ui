// Teams Registry
// Add your teams here or load from external sources
// Each user/installation can configure their own teams

import type { AgenticTeam } from '$lib/types/teams';

// Import team configurations
import { vibeshipTeam } from './vibeship';

// ============================================
// USER CONFIGURATION
// ============================================
// Add your team imports here:
// import { myTeam } from './my-team';

// Register teams you want to use:
export const registeredTeams: AgenticTeam[] = [
	vibeshipTeam,
	// Add more teams here:
	// myTeam,
];

// Set your default active team (by ID):
export const defaultActiveTeamId = 'vibeship-workforce';

// ============================================
// TEAM CREATION GUIDE
// ============================================
/*
To add a new team:

1. Create a new file: src/lib/data/teams/my-team.ts
2. Export your team configuration following the AgenticTeam interface
3. Import it above and add to registeredTeams array
4. Optionally set it as defaultActiveTeamId

Example team structure:
export const myTeam: AgenticTeam = {
  id: 'my-team-id',
  version: '1.0.0',
  name: 'My Team Name',
  description: 'Description of what this team does',
  source_path: '/path/to/agent/configs',
  infrastructure: {
    h70_mcp: { server: 'spawner-h70', tool: 'spawner_h70_skills', skill_lab: '/path/to/skills' }
  },
  divisions: {
    // Your divisions here
  },
  stats: { total_agents: 0, commanders: 0, specialists: 0, divisions: 0, unique_h70_skills: 0 },
  key_handoffs: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};
*/
