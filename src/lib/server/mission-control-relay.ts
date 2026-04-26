import { env } from '$env/dynamic/private';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeMissionControlDisplayText } from './mission-control-display';

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
	taskSkills: string[];
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
	taskCount: number;
	taskNames: string[];
	tasks: Array<{ title: string; skills: string[] }>;
}

const RELAY_EVENT_TYPES = new Set([
	'mission_created',
	'mission_started',
	'mission_paused',
	'mission_resumed',
	'mission_completed',
	'mission_failed',
	'task_started',
	'task_progress',
	'progress',
	'task_completed',
	'task_failed',
	'task_cancelled',
	'dispatch_started',
	'provider_feedback',
	'log'
]);

const MAX_RECENT_EVENTS = 80;
const DEFAULT_STALE_NON_TERMINAL_MS = 6 * 60 * 60 * 1000;

const DEFAULT_SPARK_INGEST_URL = env.SPARK_MISSION_CONTROL_INGEST_URL || '';
const DEFAULT_SPARK_TOKEN = env.SPARKD_TOKEN || '';
const DEFAULT_WEBHOOKS = (env.MISSION_CONTROL_WEBHOOK_URLS || '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean);
const DEFAULT_TELEGRAM_RELAY_SECRET = env.TELEGRAM_RELAY_SECRET || '';
const STALE_NON_TERMINAL_MS = Number(env.MISSION_CONTROL_STALE_NONTERMINAL_MS) || DEFAULT_STALE_NON_TERMINAL_MS;

// Persist relay state so HMR reloads + server restarts don't wipe the history.
// Small file, synchronous writes; we're on the order of tens of events.
export function getMissionControlPersistPath(): string {
	const spawnerDir = process.env.SPAWNER_STATE_DIR || env.SPAWNER_STATE_DIR || path.resolve(process.cwd(), '.spawner');
	return path.resolve(spawnerDir, 'mission-control.json');
}

function isMissionControlMissionId(value: unknown): value is string {
	return typeof value === 'string' && /^spark-[A-Za-z0-9_-]+$/.test(value.trim());
}

function loadPersistedState() {
	try {
		const persistPath = getMissionControlPersistPath();
		if (!fs.existsSync(persistPath)) return null;
		const raw = fs.readFileSync(persistPath, 'utf-8');
		const parsed = JSON.parse(raw);
		const recent = Array.isArray(parsed.recent)
			? parsed.recent
					.filter((entry: MissionControlRelayStatusEntry) => isMissionControlMissionId(entry?.missionId))
					.slice(0, MAX_RECENT_EVENTS)
			: [];
		const perMission = Object.entries(parsed.perMission ?? {})
			.filter(([missionId]) => isMissionControlMissionId(missionId))
			.map(([k, v]) => [k, Number(v) || 0] as [string, number]);
		return {
			totalRelayed: Number(parsed.totalRelayed) || 0,
			perMission: new Map<string, number>(perMission),
			recent
		};
	} catch {
		return null;
	}
}

function persistState() {
	try {
		const persistPath = getMissionControlPersistPath();
		const dir = path.dirname(persistPath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(
			persistPath,
			JSON.stringify({
				totalRelayed: relayState.totalRelayed,
				perMission: Object.fromEntries(relayState.perMission),
				recent: relayState.recent
			}),
			'utf-8'
		);
	} catch {
		/* persist is best-effort */
	}
}

const persisted = loadPersistedState();
const relayState: {
	totalRelayed: number;
	perMission: Map<string, number>;
	recent: MissionControlRelayStatusEntry[];
} = persisted ?? {
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

	const dataSkillsRaw = event.data && (event.data as Record<string, unknown>).skills;
	const taskSkills = Array.isArray(dataSkillsRaw)
		? dataSkillsRaw.filter((s): s is string => typeof s === 'string')
		: [];

	return {
		eventType: typeof event.type === 'string' ? event.type : 'unknown',
		missionId,
		missionName: typeof event.missionName === 'string' ? event.missionName : dataMissionName,
		taskId: typeof event.taskId === 'string' ? event.taskId : null,
		taskName: typeof event.taskName === 'string' ? event.taskName : null,
		taskSkills,
		summary: summarizeMissionControlEvent(event),
		timestamp,
		source: typeof event.source === 'string' ? event.source : 'unknown'
	};
}

function recordRelayEvent(event: MissionControlBridgeEvent): void {
	const entry = toStatusEntry(event);
	if (!isMissionControlMissionId(entry.missionId)) {
		return;
	}
	relayState.totalRelayed += 1;
	relayState.perMission.set(entry.missionId, (relayState.perMission.get(entry.missionId) || 0) + 1);
	relayState.recent.unshift(entry);
	if (relayState.recent.length > MAX_RECENT_EVENTS) {
		relayState.recent.length = MAX_RECENT_EVENTS;
	}
	persistState();
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
		case 'task_progress':
		case 'progress':
		case 'task_completed':
		case 'task_failed':
		case 'task_cancelled':
		case 'dispatch_started':
		case 'provider_feedback':
		case 'log':
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

function isStaleNonTerminalStatus(status: MissionControlBoardEntry['status'], timestamp: string): boolean {
	if (status === 'completed' || status === 'failed' || status === 'paused') {
		return false;
	}
	const updatedAt = Date.parse(timestamp);
	if (!Number.isFinite(updatedAt)) {
		return false;
	}
	return Date.now() - updatedAt > STALE_NON_TERMINAL_MS;
}

export function getMissionControlBoard(): Record<string, MissionControlBoardEntry[]> {
	const byMission = new Map<string, MissionControlBoardEntry>();

	for (const entry of relayState.recent) {
		if (!isMissionControlMissionId(entry.missionId)) continue;
		const status = mapEventTypeToBoardStatus(entry.eventType);
		if (!status) continue;
		if (isStaleNonTerminalStatus(status, entry.timestamp)) continue;

		const existing = byMission.get(entry.missionId);
		if (!existing) {
			byMission.set(entry.missionId, {
				missionId: entry.missionId,
				missionName: entry.missionName ? sanitizeMissionControlDisplayText(entry.missionName) : null,
				status,
				lastEventType: entry.eventType,
				lastUpdated: entry.timestamp,
				lastSummary: sanitizeMissionControlDisplayText(entry.summary),
				taskName: entry.taskName ? sanitizeMissionControlDisplayText(entry.taskName) : null,
				taskCount: 0,
				taskNames: [],
				tasks: []
			});
		} else {
			if (!existing.taskName && entry.taskName) existing.taskName = sanitizeMissionControlDisplayText(entry.taskName);
			if (!existing.missionName && entry.missionName) {
				existing.missionName = sanitizeMissionControlDisplayText(entry.missionName);
			}
		}

		// Count distinct tasks by watching task_started events.
		if (entry.eventType === 'task_started') {
			const current = byMission.get(entry.missionId)!;
			const label = entry.taskName ? sanitizeMissionControlDisplayText(entry.taskName) : 'task';
			if (!current.taskNames.includes(label)) {
				current.taskNames.push(label);
				current.taskCount = current.taskNames.length;
				current.tasks.push({ title: label, skills: entry.taskSkills ?? [] });
			}
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

	if (event.data && (event.data as Record<string, unknown>).suppressRelay === true) {
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
		case 'task_progress':
		case 'progress':
			return `[MissionControl] Progress: ${event.message || taskName || 'working'} (${missionId}).`;
		case 'task_completed':
			return `[MissionControl] Task completed: ${taskName || 'task'} (${missionId}).`;
		case 'task_failed':
			return `[MissionControl] Task failed: ${taskName || 'task'} (${missionId}).`;
		case 'task_cancelled':
			return `[MissionControl] Task cancelled: ${taskName || 'task'} (${missionId}).`;
		case 'dispatch_started':
			return `[MissionControl] Dispatch started (${missionId}).`;
		case 'provider_feedback':
			return `[MissionControl] Provider feedback: ${event.message || taskName || 'update'} (${missionId}).`;
		case 'log':
			return `[MissionControl] ${event.message || 'Log update'} (${missionId}).`;
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

function normalizeRelayPort(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return Math.trunc(value);
	}
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
	}
	return null;
}

function webhookPort(url: string): number | null {
	try {
		const parsed = new URL(url);
		if (parsed.port) {
			return normalizeRelayPort(parsed.port);
		}
		return parsed.protocol === 'https:' ? 443 : parsed.protocol === 'http:' ? 80 : null;
	} catch {
		return null;
	}
}

function getTelegramRelayTarget(event: MissionControlBridgeEvent): { port: number | null; url: string | null } {
	const data = event.data;
	if (!data || typeof data !== 'object') {
		return { port: null, url: null };
	}
	const relay = data.telegramRelay && typeof data.telegramRelay === 'object'
		? data.telegramRelay as Record<string, unknown>
		: null;
	const urlRaw = relay?.url ?? data.telegramRelayUrl;
	const port = normalizeRelayPort(relay?.port ?? data.telegramRelayPort);
	const url = typeof urlRaw === 'string' && urlRaw.trim() ? urlRaw.trim() : null;
	return { port, url };
}

export function selectWebhookUrlsForMissionEvent(event: MissionControlBridgeEvent, urls = DEFAULT_WEBHOOKS): string[] {
	const target = getTelegramRelayTarget(event);
	if (!target.url && target.port === null) {
		return urls;
	}
	if (target.url) {
		return urls.filter((url) => url === target.url);
	}
	return urls.filter((url) => {
		if (target.port !== null && webhookPort(url) === target.port) {
			return true;
		}
		return false;
	});
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

	const webhookUrls = selectWebhookUrlsForMissionEvent(event);
	if (webhookUrls.length > 0) {
		const webhookPayload = {
			type: 'mission_control_event',
			timestamp: new Date().toISOString(),
			summary: summarizeMissionControlEvent(event),
			event
		};
		const relayHeaders = DEFAULT_TELEGRAM_RELAY_SECRET
			? { 'X-Spark-Telegram-Relay-Secret': DEFAULT_TELEGRAM_RELAY_SECRET }
			: undefined;
		for (const url of webhookUrls) {
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
