// Agentic Teams Type Definitions
// Vibeship Spawner UI

export interface AgentSkill {
  skill_id: string;
  mode: 'primary' | 'secondary';
}

export interface AgentHandoff {
  target: string;
  trigger: string;
  sla?: string;
  payload?: Record<string, string>;
}

export interface AgentMemory {
  namespaces: string[];
  temporal_level: number;
  salience: number;
}

export interface Agent {
  id: string;
  name: string;
  role: 'Commander' | 'Specialist';
  division: string;
  description: string;
  file: string;
  h70_skills: string[];
  memory?: AgentMemory;
  handoff_to?: AgentHandoff[];
  receives_from?: { source: string; trigger: string }[];
  reports_to?: string;
  direct_reports?: string[];
}

export interface Division {
  name: string;
  commander: string;
  description: string;
  agents: Agent[];
}

export interface TeamInfrastructure {
  h70_mcp: {
    server: string;
    tool: string;
    skill_lab: string;
  };
}

export interface TeamHandoff {
  from: string;
  to: string;
  trigger: string;
}

export interface TeamStats {
  total_agents: number;
  commanders: number;
  specialists: number;
  divisions: number;
  unique_h70_skills: number;
}

export interface AgenticTeam {
  id: string;
  version: string;
  name: string;
  description: string;
  source_path: string;
  infrastructure: TeamInfrastructure;
  divisions: Record<string, Division>;
  stats: TeamStats;
  key_handoffs: TeamHandoff[];
  created_at: string;
  updated_at: string;
}

export interface TeamRegistry {
  teams: AgenticTeam[];
  active_team_id: string | null;
}

// Agent status during runtime
export interface AgentStatus {
  agent_id: string;
  status: 'idle' | 'working' | 'waiting' | 'error';
  current_task?: string;
  last_activity?: string;
  memory_count?: number;
}

// Team runtime state
export interface TeamRuntime {
  team_id: string;
  is_running: boolean;
  agent_statuses: Record<string, AgentStatus>;
  active_handoffs: TeamHandoff[];
  started_at?: string;
}
