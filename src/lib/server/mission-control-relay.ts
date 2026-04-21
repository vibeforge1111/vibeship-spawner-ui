import { env } from '$env/dynamic/private';

export interface MissionControlBridgeEvent {
	id?: string;
	type?: string;
	missionId?: string;
	missionName?: string;
	taskId?: string;
	taskName?: string;
	message?: string;
	timestamp?: string;
	source?: string;
	data?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface MissionControlRelayStatusEntry {
	eventType: string;
	missionId: string;
	missionName: string | null;
	taskId: string | null;
	taskName: string | null;
	summary: string;
	timestamp: string;
	source: string;
}

export interface MissionControlRelaySnapshot {
	enabled: {
		sparkIngest: boolean;
		webhooks: boolean;
	};
	targets: {
		sparkIngestUrl: string | null;
		webhookCount: number;
	};
	stats: {
		totalRelayed: number;
		perMission: Record<string, number>;
	};
	recent: MissionControlRelayStatusEntry[];
}

export interface MissionControlBoardEntry {
	missionId: string;
	missionName: string | null;
	status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
	lastEventType: string;
	lastUpdated: string;
	lastSummary: string;
	taskName: string | null;
}

const RELAY_EVENT_TYPES = new Set([
	'mission_created',
	'mission_started',
	'mission_paused',
	'mission_resumed',
	'mission_completed',
	'mission_failed',
	'task_started',
	'task_completed',
	'task_failed',
	'task_cancelled'
]);

const MAX_RECENT_EVENTS = 80;

const DEFAULT_SPARK_INGEST_URL = env.SPARK_MISSION_CONTROL_INGEST_URL || '';
const DEFAULT_SPARK_TOKEN = env.SPARKD_TOKEN || '';
const DEFAULT_WEBHOOKS = (env.MISSION_CONTROL_WEBHOOK_URLS || '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);
const DEFAULT_TELEGRAM_RELAY_SECRET = env.TELEGRAM_RELAY_SECRET || '';

const relayState: {
	totalRelayed: number;
	perMission: Map<string, number>;
	recent: MissionControlRelayStatusEntry[];
} = {
	totalRelayed: 0,
	perMission: new Map<string, number>(),
	recent: []
};

function normalizeMissionId(event: MissionControlBridgeEvent): string {
	return typeof event.missionId === 'string' && event.missionId.trim().length > 0 ? event.missionId : 'unknown-mission';
}

function toStatusEntry(event: MissionControlBridgeEvent): MissionControlRelayStatusEntry {
	const missionId = normalizeMissionId(event);
	const timestamp =
		typeof event.timestamp === 'string' && event.timestamp.trim().length > 0
			? event.timestamp
			: new Date().toISOString();

	const dataMissionName =
		event.data && typeof (event.data as Record<string, unknown>).missionName === 'string'
			? ((event.data as Record<string, unknown>).missionName as string)
			: null;

	return {
		eventType: typeof event.type === 'string' ? event.type : 'unknown',
		missionId,
		missionName: typeof event.missionName === 'string' ? event.missionName : dataMissionName,
		taskId: typeof event.taskId === 'string' ? event.taskId : null,
		taskName: typeof event.taskName === 'string' ? event.taskName : null,
		summary: summarizeMissionControlEvent(event),
		timestamp,
		source: typeof event.source === 'string' ? event.source : 'unknown'
	};
}

function recordRelayEvent(event: MissionControlBridgeEvent): void {
	const entry = toStatusEntry(event);
	relayState.totalRelayed += 1;
	relayState.perMission.set(entry.missionId, (relayState.perMission.get(entry.missionId) || 0) + 1);
	relayState.recent.unshift(entry);
	if (relayState.recent.length > MAX_RECENT_EVENTS) {
		relayState.recent.length = MAX_RECENT_EVENTS;
	}
}

export function getMissionControlRelaySnapshot(missionId?: string): MissionControlRelaySnapshot {
	const normalizedMission =
		typeof missionId === 'string' && missionId.trim().length > 0 ? missionId.trim() : undefined;

	const perMission = Object.fromEntries(relayState.perMission.entries());
	const recent = normalizedMission
		? relayState.recent.filter((entry) => entry.missionId === normalizedMission).slice(0, 25)
		: relayState.recent.slice(0, 25);

	return {
		enabled: {
			sparkIngest: Boolean(DEFAULT_SPARK_INGEST_URL),
			webhooks: DEFAULT_WEBHOOKS.length > 0
		},
		targets: {
			sparkIngestUrl: DEFAULT_SPARK_INGEST_URL || null,
			webhookCount: DEFAULT_WEBHOOKS.length
		},
		stats: {
			totalRelayed: relayState.totalRelayed,
			perMission
		},
		recent
	};
}

function mapEventTypeToBoardStatus(eventType: string): MissionControlBoardEntry['status'] | null {
	switch (eventType) {
		case 'mission_created':
			return 'created';
		case 'mission_started':
		case 'mission_resumed':
		case 'task_started':
		case 'task_completed':
		case 'task_failed':
		case 'task_cancelled':
			return 'running';
		case 'mission_paused':
			return 'paused';
		case 'mission_completed':
			return 'completed';
		case 'mission_failed':
			return 'failed';
		default:
			return null;
	}
}

export function getMissionControlBoard(): Record<string, MissionControlBoardEntry[]> {
	const byMission = new Map<string, MissionControlBoardEntry>();

	for (const entry of relayState.recent) {
		const status = mapEventTypeToBoardStatus(entry.eventType);
		if (!status) continue;

		const existing = byMission.get(entry.missionId);
		if (!existing) {
			byMission.set(entry.missionId, {
				missionId: entry.missionId,
				missionName: entry.missionName,
				status,
				lastEventType: entry.eventType,
				lastUpdated: entry.timestamp,
				lastSummary: entry.summary,
				taskName: entry.taskName
			});
			continue;
		}

		if (!existing.taskName && entry.taskName) {
			existing.taskName = entry.taskName;
		}
		if (!existing.missionName && entry.missionName) {
			existing.missionName = entry.missionName;
		}
	}

	const board: Record<string, MissionControlBoardEntry[]> = {
		running: [],
		paused: [],
		completed: [],
		failed: [],
		created: []
	};

	for (const entry of byMission.values()) {
		board[entry.status].push(entry);
	}

	for (const entries of Object.values(board)) {
		entries.sort((a, b) => Date.parse(b.lastUpdated) - Date.parse(a.lastUpdated));
	}

	return board;
}

export function shouldRelayMissionControlEvent(event: MissionControlBridgeEvent): boolean {
	const type = typeof event.type === 'string' ? event.type : '';
	if (!type || !RELAY_EVENT_TYPES.has(type)) {
		return false;
	}

	const source = typeof event.source === 'string' ? event.source : '';
	if (source === 'spawner-ui') {
		return false;
	}

	return true;
}

export function summarizeMissionControlEvent(event: MissionControlBridgeEvent): string {
	const type = typeof event.type === 'string' ? event.type : 'event';
	const missionId = normalizeMissionId(event);
	const taskName =
		typeof event.taskName === 'string'
			? event.taskName
			: typeof event.taskId === 'string'
				? event.taskId
				: undefined;

	switch (type) {
		case 'mission_created':
			return `[MissionControl] Mission created (${missionId}).`;
		case 'mission_started':
			return `[MissionControl] Mission started (${missionId}).`;
		case 'mission_paused':
			return `[MissionControl] Mission paused (${missionId}).`;
		case 'mission_resumed':
			return `[MissionControl] Mission resumed (${missionId}).`;
		case 'mission_completed':
			return `[MissionControl] Mission completed (${missionId}).`;
		case 'mission_failed':
			return `[MissionControl] Mission failed (${missionId}).`;
		case 'task_started':
			return `[MissionControl] Task started: ${taskName || 'task'} (${missionId}).`;
		case 'task_completed':
			return `[MissionControl] Task completed: ${taskName || 'task'} (${missionId}).`;
		case 'task_failed':
			return `[MissionControl] Task failed: ${taskName || 'task'} (${missionId}).`;
		case 'task_cancelled':
			return `[MissionControl] Task cancelled: ${taskName || 'task'} (${missionId}).`;
		default:
			return `[MissionControl] ${type} (${missionId}).`;
	}
}

export function buildSparkMissionControlEvent(event: MissionControlBridgeEvent): Record<string, unknown> {
	const tsMs = event.timestamp ? Date.parse(event.timestamp) : Date.now();
	const ts = Number.isFinite(tsMs) ? Math.max(1, tsMs / 1000) : Date.now() / 1000;
	const missionId = normalizeMissionId(event);

	return {
		v: 1,
		source: 'spawner-ui',
		kind: 'system',
		ts,
		session_id: `mission-control:${missionId}`,
		trace_id:
			typeof event.id === 'string'
				? event.id
				: `mc-${missionId}-${typeof event.type === 'string' ? event.type : 'event'}-${Math.floor(ts * 1000)}`,
		payload: {
			event_type: 'mission_control_event',
			mission_event_type: typeof event.type === 'string' ? event.type : 'unknown',
			mission_id: typeof event.missionId === 'string' ? event.missionId : null,
			task_id: typeof event.taskId === 'string' ? event.taskId : null,
			task_name: typeof event.taskName === 'string' ? event.taskName : null,
			message: typeof event.message === 'string' ? event.message : null,
			summary: summarizeMissionControlEvent(event),
			bridge_source: typeof event.source === 'string' ? event.source : 'unknown',
			meta: {
				origin: 'spawner-ui',
				event_id: typeof event.id === 'string' ? event.id : null
			},
			data: typeof event.data === 'object' && event.data ? event.data : {},
			raw: event
		}
	};
}

async function postJson(url: string, payload: unknown, token?: string, extraHeaders?: Record<string, string>): Promise<void> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 7_000);
	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (extraHeaders) {
			Object.assign(headers, extraHeaders);
		}
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(payload),
			signal: controller.signal
		});

		if (!response.ok) {
			const body = await response.text().catch(() => '');
			throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
		}
	} finally {
		clearTimeout(timeout);
	}
}

export async function relayMissionControlEvent(event: MissionControlBridgeEvent): Promise<void> {
	if (!shouldRelayMissionControlEvent(event)) {
		return;
	}

	recordRelayEvent(event);

	const tasks: Promise<void>[] = [];
	const sparkIngestUrl = DEFAULT_SPARK_INGEST_URL;
	if (sparkIngestUrl) {
		const sparkPayload = buildSparkMissionControlEvent(event);
		tasks.push(
			postJson(sparkIngestUrl, sparkPayload, DEFAULT_SPARK_TOKEN).catch((error) => {
				console.warn('[MissionControlRelay] Spark ingest relay failed:', error);
			})
		);
	}

	if (DEFAULT_WEBHOOKS.length > 0) {
		const webhookPayload = {
			type: 'mission_control_event',
			timestamp: new Date().toISOString(),
			summary: summarizeMissionControlEvent(event),
			event
		};
		const relayHeaders = DEFAULT_TELEGRAM_RELAY_SECRET
			? { 'X-Spark-Telegram-Relay-Secret': DEFAULT_TELEGRAM_RELAY_SECRET }
			: undefined;
		for (const url of DEFAULT_WEBHOOKS) {
			tasks.push(
				postJson(url, webhookPayload, undefined, relayHeaders).catch((error) => {
					console.warn(`[MissionControlRelay] Webhook relay failed (${url}):`, error);
				})
			);
		}
	}

	if (tasks.length > 0) {
		await Promise.all(tasks);
	}
}
