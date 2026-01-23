// Agentic Teams Service
// Manages agent team configurations and orchestration
// Vibeship Spawner UI

import type {
  AgenticTeam,
  TeamRegistry,
  Agent,
  Division,
  TeamRuntime,
  AgentStatus
} from '$lib/types/teams';
import { writable, derived, get } from 'svelte/store';

// ============================================
// STORES
// ============================================

export const teamRegistry = writable<TeamRegistry>({
  teams: [],
  active_team_id: null
});

export const teamRuntime = writable<TeamRuntime | null>(null);

// Derived stores
export const activeTeam = derived(teamRegistry, ($registry) => {
  if (!$registry.active_team_id) return null;
  return $registry.teams.find(t => t.id === $registry.active_team_id) || null;
});

export const allAgents = derived(activeTeam, ($team) => {
  if (!$team) return [];
  const agents: Agent[] = [];
  Object.values($team.divisions).forEach(division => {
    agents.push(...division.agents);
  });
  return agents;
});

export const commanders = derived(allAgents, ($agents) =>
  $agents.filter(a => a.role === 'Commander')
);

export const specialists = derived(allAgents, ($agents) =>
  $agents.filter(a => a.role === 'Specialist')
);

// ============================================
// TEAM MANAGEMENT
// ============================================

/**
 * Load teams from the data directory
 */
export async function loadTeams(): Promise<void> {
  try {
    // Load from local data
    const response = await fetch('/api/teams');
    if (response.ok) {
      const data = await response.json();
      teamRegistry.set(data);
    }
  } catch (error) {
    console.error('Failed to load teams:', error);
  }
}

/**
 * Register a new team
 */
export function registerTeam(team: AgenticTeam): void {
  teamRegistry.update(registry => ({
    ...registry,
    teams: [...registry.teams.filter(t => t.id !== team.id), team]
  }));
}

/**
 * Set the active team
 */
export function setActiveTeam(teamId: string): void {
  teamRegistry.update(registry => ({
    ...registry,
    active_team_id: teamId
  }));
}

/**
 * Get a specific agent by ID
 */
export function getAgent(agentId: string): Agent | null {
  const agents = get(allAgents);
  return agents.find(a => a.id === agentId) || null;
}

/**
 * Get agents in a division
 */
export function getAgentsByDivision(divisionId: string): Agent[] {
  const team = get(activeTeam);
  if (!team) return [];
  const division = team.divisions[divisionId];
  return division?.agents || [];
}

/**
 * Get an agent's commander
 */
export function getAgentCommander(agentId: string): Agent | null {
  const agent = getAgent(agentId);
  if (!agent || !agent.reports_to) return null;
  return getAgent(agent.reports_to);
}

/**
 * Get agents that can receive handoffs from this agent
 */
export function getHandoffTargets(agentId: string): Agent[] {
  const agent = getAgent(agentId);
  if (!agent || !agent.handoff_to) return [];

  return agent.handoff_to
    .map(h => getAgent(h.target))
    .filter((a): a is Agent => a !== null);
}

// ============================================
// H70 SKILL INTEGRATION
// ============================================

/**
 * Get all H70 skills used by a team
 */
export function getTeamSkills(teamId?: string): string[] {
  const team = teamId
    ? get(teamRegistry).teams.find(t => t.id === teamId)
    : get(activeTeam);

  if (!team) return [];

  const skills = new Set<string>();
  Object.values(team.divisions).forEach(division => {
    division.agents.forEach(agent => {
      agent.h70_skills.forEach(skill => skills.add(skill));
    });
  });

  return Array.from(skills).sort();
}

/**
 * Get agents that use a specific skill
 */
export function getAgentsBySkill(skillId: string): Agent[] {
  return get(allAgents).filter(a => a.h70_skills.includes(skillId));
}

/**
 * Load H70 skill for an agent via MCP
 */
export async function loadAgentSkill(agentId: string, skillId: string): Promise<any> {
  const team = get(activeTeam);
  if (!team) throw new Error('No active team');

  const { h70_mcp } = team.infrastructure;

  // Call the H70 MCP server
  const response = await fetch('/api/mcp/h70', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: h70_mcp.tool,
      action: 'get',
      skill_id: skillId
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to load skill: ${skillId}`);
  }

  return response.json();
}

// ============================================
// MIND V5 INTEGRATION
// ============================================

/**
 * Save agent memory to Mind v5
 */
export async function saveAgentMemory(
  agentId: string,
  content: string,
  options: {
    temporal_level?: number;
    salience?: number;
    content_type?: string;
  } = {}
): Promise<any> {
  const team = get(activeTeam);
  if (!team) throw new Error('No active team');

  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const { mind_v5 } = team.infrastructure;

  const response = await fetch(`${mind_v5.api}/v1/memories/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `[${agentId}] ${content}`,
      temporal_level: options.temporal_level || agent.memory?.temporal_level || 2,
      salience: options.salience || agent.memory?.salience || 0.7,
      content_type: options.content_type || 'observation',
      metadata: {
        agent_id: agentId,
        division: agent.division,
        namespaces: agent.memory?.namespaces || []
      }
    })
  });

  if (!response.ok) {
    throw new Error('Failed to save memory');
  }

  return response.json();
}

/**
 * Retrieve agent memories from Mind v5
 */
export async function getAgentMemories(
  agentId: string,
  query?: string,
  limit: number = 10
): Promise<any[]> {
  const team = get(activeTeam);
  if (!team) throw new Error('No active team');

  const { mind_v5 } = team.infrastructure;

  const searchQuery = query || agentId;

  const response = await fetch(`${mind_v5.api}/v1/memories/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: searchQuery,
      limit
    })
  });

  if (!response.ok) {
    throw new Error('Failed to retrieve memories');
  }

  const data = await response.json();
  return data.memories || [];
}

// ============================================
// RUNTIME MANAGEMENT
// ============================================

/**
 * Initialize team runtime
 */
export function initializeRuntime(teamId: string): void {
  const team = get(teamRegistry).teams.find(t => t.id === teamId);
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const agentStatuses: Record<string, AgentStatus> = {};

  Object.values(team.divisions).forEach(division => {
    division.agents.forEach(agent => {
      agentStatuses[agent.id] = {
        agent_id: agent.id,
        status: 'idle',
        last_activity: new Date().toISOString()
      };
    });
  });

  teamRuntime.set({
    team_id: teamId,
    is_running: true,
    agent_statuses: agentStatuses,
    active_handoffs: [],
    started_at: new Date().toISOString()
  });
}

/**
 * Update agent status
 */
export function updateAgentStatus(
  agentId: string,
  status: AgentStatus['status'],
  task?: string
): void {
  teamRuntime.update(runtime => {
    if (!runtime) return runtime;

    return {
      ...runtime,
      agent_statuses: {
        ...runtime.agent_statuses,
        [agentId]: {
          ...runtime.agent_statuses[agentId],
          status,
          current_task: task,
          last_activity: new Date().toISOString()
        }
      }
    };
  });
}

/**
 * Trigger a handoff between agents
 */
export async function triggerHandoff(
  fromAgentId: string,
  toAgentId: string,
  trigger: string,
  payload: Record<string, any>
): Promise<void> {
  const fromAgent = getAgent(fromAgentId);
  const toAgent = getAgent(toAgentId);

  if (!fromAgent || !toAgent) {
    throw new Error('Invalid handoff agents');
  }

  // Validate handoff is allowed
  const handoff = fromAgent.handoff_to?.find(h => h.target === toAgentId);
  if (!handoff) {
    throw new Error(`Handoff not allowed: ${fromAgentId} -> ${toAgentId}`);
  }

  // Update runtime state
  teamRuntime.update(runtime => {
    if (!runtime) return runtime;

    return {
      ...runtime,
      active_handoffs: [
        ...runtime.active_handoffs,
        { from: fromAgentId, to: toAgentId, trigger }
      ]
    };
  });

  // Update agent statuses
  updateAgentStatus(fromAgentId, 'idle');
  updateAgentStatus(toAgentId, 'working', trigger);

  // Save handoff to memory
  await saveAgentMemory(fromAgentId, `Handed off to ${toAgentId}: ${trigger}`, {
    content_type: 'event',
    temporal_level: 3
  });

  console.log(`Handoff: ${fromAgentId} -> ${toAgentId} [${trigger}]`);
}

/**
 * Stop team runtime
 */
export function stopRuntime(): void {
  teamRuntime.set(null);
}

// ============================================
// INITIALIZATION
// ============================================

// Auto-load teams on module import
if (typeof window !== 'undefined') {
  loadTeams();
}
