import { env } from '$env/dynamic/private';
import * as fs from 'fs';
import * as path from 'path';
import { spawnerStateDir } from './spawner-state';

export const AGENT_EVENT_SCHEMA_VERSION = 'spark.agent_event.v1';
export const AGENT_EVENT_COMPONENT = 'agent_event_model';

export type AgentEventType =
	| 'task_intent_detected'
	| 'route_selected'
	| 'source_used'
	| 'capability_probed'
	| 'blocker_detected'
	| 'memory_candidate_created'
	| 'contradiction_found'
	| 'mission_changed_state'
	| 'agent_drift_detected'
	| 'user_override_received'
	| 'action_gate_evaluated'
	| 'final_answer_checked';

export type SourceFreshness = 'fresh' | 'stale' | 'contradicted' | 'unknown' | 'live_probed';

export interface AgentSourceRef {
	source: string;
	role: string;
	freshness: SourceFreshness;
	source_ref: string | null;
	summary: string;
}

export interface AgentEventRecord {
	schema_version: typeof AGENT_EVENT_SCHEMA_VERSION;
	event_type: AgentEventType;
	summary: string;
	user_intent: string | null;
	selected_route: string | null;
	route_confidence: string | null;
	facts: Record<string, unknown>;
	sources: AgentSourceRef[];
	assumptions: string[];
	blockers: string[];
	changed: string[];
	memory_candidate: Record<string, unknown> | null;
}

export interface AgentEventLedgerEntry extends AgentEventRecord {
	event_id: string;
	component: typeof AGENT_EVENT_COMPONENT;
	created_at: string;
	request_id: string | null;
	session_id: string | null;
	actor_id: string | null;
}

export interface MissionControlAgentEventInput {
	eventType: string;
	missionId: string;
	missionName: string | null;
	taskId: string | null;
	taskName: string | null;
	progress: number | null;
	summary: string;
	timestamp: string;
	source: string;
	requestId?: string | null;
	toState?: string | null;
}

export function getAgentEventLedgerPath(): string {
	return path.resolve(spawnerStateDir(env), 'agent-events.jsonl');
}

export function buildMissionControlAgentEvent(input: MissionControlAgentEventInput): AgentEventRecord {
	const missionRef = input.missionId || 'unknown-mission';
	const toState = input.toState || missionStateForEvent(input.eventType);
	const changed = [`${missionRef}:mission_event=${input.eventType}`];
	if (toState) {
		changed.push(`${missionRef}:state=${toState}`);
	}

	return {
		schema_version: AGENT_EVENT_SCHEMA_VERSION,
		event_type: 'mission_changed_state',
		summary: input.summary || `Mission Control recorded ${input.eventType}.`,
		user_intent: null,
		selected_route: 'mission_control',
		route_confidence: 'high',
		facts: {
			mission_id: missionRef,
			mission_event_type: input.eventType,
			mission_name: input.missionName,
			task_id: input.taskId,
			task_name: input.taskName,
			progress: input.progress,
			to_state: toState,
			bridge_source: input.source
		},
		sources: [
			{
				source: 'mission_trace',
				role: 'work_state_evidence',
				freshness: 'fresh',
				source_ref: missionRef,
				summary: input.summary || input.eventType
			}
		],
		assumptions: [],
		blockers: [],
		changed,
		memory_candidate: null
	};
}

export function appendAgentEvent(
	event: AgentEventRecord,
	options: { requestId?: string | null; sessionId?: string | null; actorId?: string | null } = {}
): AgentEventLedgerEntry {
	const entry: AgentEventLedgerEntry = {
		...event,
		event_id: `agent-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
		component: AGENT_EVENT_COMPONENT,
		created_at: new Date().toISOString(),
		request_id: normalizeNullable(options.requestId),
		session_id: normalizeNullable(options.sessionId),
		actor_id: normalizeNullable(options.actorId)
	};
	const ledgerPath = getAgentEventLedgerPath();
	fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
	fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, 'utf-8');
	return entry;
}

export function readRecentAgentEvents(options: { requestId?: string | null; limit?: number } = {}): AgentEventLedgerEntry[] {
	const ledgerPath = getAgentEventLedgerPath();
	if (!fs.existsSync(ledgerPath)) return [];
	const limit = Math.max(1, options.limit || 20);
	const requestId = normalizeNullable(options.requestId);
	return fs
		.readFileSync(ledgerPath, 'utf-8')
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line) as AgentEventLedgerEntry;
			} catch {
				return null;
			}
		})
		.filter((entry): entry is AgentEventLedgerEntry => Boolean(entry))
		.filter((entry) => !requestId || entry.request_id === requestId)
		.slice(-limit)
		.reverse();
}

export function missionStateForEvent(eventType: string): string | null {
	switch (eventType) {
		case 'mission_created':
			return 'created';
		case 'mission_started':
		case 'mission_resumed':
		case 'dispatch_started':
			return 'running';
		case 'mission_paused':
			return 'paused';
		case 'mission_completed':
			return 'completed';
		case 'mission_failed':
			return 'failed';
		case 'mission_cancelled':
			return 'cancelled';
		case 'task_started':
		case 'task_progress':
		case 'progress':
			return 'running';
		case 'task_completed':
			return 'task_completed';
		case 'task_failed':
			return 'task_failed';
		case 'task_cancelled':
			return 'task_cancelled';
		default:
			return null;
	}
}

function normalizeNullable(value: string | null | undefined): string | null {
	const text = value?.trim();
	return text || null;
}
