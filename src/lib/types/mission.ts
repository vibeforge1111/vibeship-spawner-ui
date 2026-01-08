/**
 * Mission Types - Unified format for agent orchestration
 *
 * Works with:
 * - Option A: Claude Code manual execution
 * - Option B: Direct Anthropic API
 * - Option C: Claude Code SDK
 */

export type ExecutionMode = 'claude-code' | 'api' | 'sdk';

export type AgentRole =
  | 'planner'
  | 'frontend'
  | 'backend'
  | 'database'
  | 'testing'
  | 'devops'
  | 'security'
  | 'custom';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed';

export type HandoffType =
  | 'sequential'   // A -> B -> C
  | 'parallel'     // A, B, C run together
  | 'conditional'  // A -> (if X then B else C)
  | 'review';      // A -> B reviews A's work

/**
 * An agent in the mission
 */
export interface MissionAgent {
  id: string;
  name: string;
  role: AgentRole;
  skills: string[];           // Skill IDs to load
  systemPrompt?: string;      // Custom system prompt
  model?: 'sonnet' | 'opus' | 'haiku';
  temperature?: number;
}

/**
 * A task to be executed
 */
export interface MissionTask {
  id: string;
  title: string;
  description: string;
  assignedTo: string;         // Agent ID
  dependsOn?: string[];       // Task IDs that must complete first
  status: TaskStatus;
  handoffType: HandoffType;
  handoffTo?: string[];       // Agent IDs to hand off to
  outputs?: TaskOutput[];     // What this task produces
  inputs?: TaskInput[];       // What this task needs
}

/**
 * Output from a task
 */
export interface TaskOutput {
  type: 'file' | 'code' | 'data' | 'decision';
  path?: string;              // For files
  description: string;
}

/**
 * Input required for a task
 */
export interface TaskInput {
  type: 'file' | 'code' | 'data' | 'context';
  fromTask?: string;          // Task ID that provides this
  path?: string;              // For files
  description: string;
}

/**
 * Execution context for the mission
 */
export interface MissionContext {
  projectPath: string;        // Working directory
  projectType: string;        // saas, marketplace, etc.
  techStack?: string[];       // Detected or specified tech
  constraints?: string[];     // Things to avoid or requirements
  goals: string[];            // What success looks like
}

/**
 * Execution log entry
 */
export interface MissionLogEntry {
  timestamp: string;
  agentId: string;
  taskId: string;
  type: 'start' | 'progress' | 'handoff' | 'complete' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

/**
 * The complete mission definition
 */
export interface Mission {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: string;

  // Execution configuration
  mode: ExecutionMode;

  // The team
  agents: MissionAgent[];

  // The work
  tasks: MissionTask[];

  // The context
  context: MissionContext;

  // Execution state (updated during run)
  status: 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed';
  currentTaskId?: string;
  log: MissionLogEntry[];

  // Results
  outputs?: Record<string, unknown>;
  error?: string;
}

/**
 * Mission template for quick starts
 */
export interface MissionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  agents: Omit<MissionAgent, 'id'>[];
  tasks: Omit<MissionTask, 'id' | 'status'>[];
  suggestedFor: string[];     // Project types
}

/**
 * Create a new empty mission
 */
export function createMission(name: string, mode: ExecutionMode = 'claude-code'): Mission {
  return {
    id: `mission_${Date.now()}`,
    name,
    description: '',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    mode,
    agents: [],
    tasks: [],
    context: {
      projectPath: '',
      projectType: 'other',
      goals: []
    },
    status: 'draft',
    log: []
  };
}

/**
 * Add an agent to a mission
 */
export function addAgent(mission: Mission, agent: Omit<MissionAgent, 'id'>): Mission {
  const id = `agent_${mission.agents.length + 1}`;
  return {
    ...mission,
    agents: [...mission.agents, { ...agent, id }]
  };
}

/**
 * Add a task to a mission
 */
export function addTask(mission: Mission, task: Omit<MissionTask, 'id' | 'status'>): Mission {
  const id = `task_${mission.tasks.length + 1}`;
  return {
    ...mission,
    tasks: [...mission.tasks, { ...task, id, status: 'pending' }]
  };
}

/**
 * Export mission to JSON (for Claude Code execution)
 */
export function exportMission(mission: Mission): string {
  return JSON.stringify(mission, null, 2);
}

/**
 * Generate Claude Code prompt from mission
 */
export function generateClaudeCodePrompt(mission: Mission): string {
  const agentList = mission.agents
    .map(a => `- **${a.name}** (${a.role}): Skills: ${a.skills.join(', ')}`)
    .join('\n');

  const taskList = mission.tasks
    .map(t => {
      const agent = mission.agents.find(a => a.id === t.assignedTo);
      const deps = t.dependsOn?.length
        ? `(after: ${t.dependsOn.join(', ')})`
        : '';
      return `- [ ] **${t.title}** → ${agent?.name || 'Unassigned'} ${deps}\n  ${t.description}`;
    })
    .join('\n');

  return `# Mission: ${mission.name}

${mission.description}

## Context
- **Project Path:** ${mission.context.projectPath}
- **Project Type:** ${mission.context.projectType}
- **Tech Stack:** ${mission.context.techStack?.join(', ') || 'Not specified'}

## Goals
${mission.context.goals.map(g => `- ${g}`).join('\n')}

## Team
${agentList}

## Tasks
${taskList}

## Progress Reporting

Report progress to Spawner UI via HTTP POST to \`http://localhost:5173/api/events\`:

\`\`\`bash
# Task started: curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"task_started","missionId":"${mission.id}","taskId":"ID","taskName":"NAME"}'
# Progress: curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"progress","progress":50,"message":"..."}'
# Task done: curl -X POST http://localhost:5173/api/events -H "Content-Type: application/json" -d '{"type":"task_completed","taskId":"ID","data":{"success":true}}'
\`\`\`

## Execution Instructions

For each task:
1. POST \`task_started\` event
2. Load the assigned agent's skills using \`spawner_load\`
3. Execute the task following the skill's patterns
4. POST \`progress\` events periodically
5. POST \`task_completed\` event when done
6. When complete, hand off to the next agent if specified

Start with the first task that has no dependencies.
`;
}
