import { eventBridge } from '$lib/services/event-bridge';
import {
	getMissionControlBoard,
	relayMissionControlEvent,
	type MissionControlBoardEntry
} from '$lib/server/mission-control-relay';
import { providerRuntime } from '$lib/server/provider-runtime';
import { mcpClient } from '$lib/services/mcp-client';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type MissionControlAction = 'pause' | 'resume' | 'kill' | 'status';

const ACTION_TO_EVENT: Record<Exclude<MissionControlAction, 'status' | 'kill'>, string> = {
	pause: 'mission_paused',
	resume: 'mission_resumed'
};

const ACTIVE_MISSION_PATH = path.join(process.cwd(), '.spawner', 'active-mission.json');

export function isMissionControlAction(value: unknown): value is MissionControlAction {
	return value === 'pause' || value === 'resume' || value === 'kill' || value === 'status';
}

function buildBridgeEvent(missionId: string, type: string, source: string) {
	return {
		type,
		missionId,
		source,
		timestamp: new Date().toISOString(),
		id: `mc-cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
	};
}

function findMissionBoardEntry(missionId: string): MissionControlBoardEntry | null {
	const board = getMissionControlBoard();
	for (const entries of Object.values(board)) {
		const match = entries.find((entry) => entry.missionId === missionId);
		if (match) return match;
	}
	return null;
}

function hasRuntimeStatusSignal(status: ReturnType<typeof providerRuntime.getMissionStatus>): boolean {
	return (
		Object.keys(status.providers).length > 0 ||
		status.paused ||
		Boolean(status.pausedReason) ||
		status.snapshotAvailable
	);
}

async function syncActiveMissionFile(
	missionId: string,
	status: 'running' | 'paused' | 'failed' | 'cancelled',
	note?: string
): Promise<void> {
	if (!existsSync(ACTIVE_MISSION_PATH)) return;
	try {
		const raw = await readFile(ACTIVE_MISSION_PATH, 'utf-8');
		const active = JSON.parse(raw) as Record<string, unknown>;
		if ((active.missionId as string | undefined) !== missionId) {
			return;
		}

		active.status = status;
		active.lastUpdated = new Date().toISOString();
		if (typeof note === 'string' && note.trim()) {
			active.note = note.trim();
		}
		await writeFile(ACTIVE_MISSION_PATH, JSON.stringify(active, null, 2), 'utf-8');
	} catch (error) {
		console.warn('[MissionControl] Failed to sync active mission file:', error);
	}
}

async function syncMissionRecord(
	missionId: string,
	action: MissionControlAction,
	message?: string
): Promise<void> {
	try {
		if (action === 'resume') {
			await mcpClient.startMission(missionId);
			return;
		}
		if (action === 'kill') {
			await mcpClient.failMission(missionId, message || 'Mission killed via mission control');
			return;
		}
		if (action === 'pause') {
			await mcpClient.updateMission(missionId, {
				status: 'paused',
				outputs: { mission_control: { pausedAt: new Date().toISOString() } }
			});
		}
	} catch (error) {
		console.warn('[MissionControl] Mission store sync failed:', error);
	}
}

export async function executeMissionControlAction(input: {
	missionId: string;
	action: MissionControlAction;
	source?: string;
}): Promise<Record<string, unknown>> {
	const missionId = input.missionId.trim();
	const source = input.source?.trim() || 'mission-control';
	const action = input.action;

	if (action === 'status') {
		const status = providerRuntime.getMissionStatus(missionId);
		const boardEntry = findMissionBoardEntry(missionId);
		if (!hasRuntimeStatusSignal(status) && !boardEntry) {
			return {
				ok: false,
				missionId,
				action,
				error: `Mission ${missionId} was not found. Use /board to pick a current mission ID.`
			};
		}
		return {
			ok: true,
			missionId,
			action,
			status: {
				...status,
				boardStatus: boardEntry?.status ?? null,
				lastEventType: boardEntry?.lastEventType ?? null,
				lastUpdated: boardEntry?.lastUpdated ?? null
			}
		};
	}

	const currentStatus = providerRuntime.getMissionStatus(missionId);
	const boardEntry = findMissionBoardEntry(missionId);
	if (!hasRuntimeStatusSignal(currentStatus) && !boardEntry) {
		return {
			ok: false,
			missionId,
			action,
			error: `Mission ${missionId} was not found. Use /board to pick a current mission ID.`
		};
	}

	if (action === 'pause' && boardEntry && ['completed', 'failed'].includes(boardEntry.status)) {
		return {
			ok: false,
			missionId,
			action,
			error: `Mission ${missionId} is already ${boardEntry.status} and cannot be paused.`
		};
	}

	if (action === 'kill') {
		await providerRuntime.cancelMission(missionId, 'Mission cancelled by user');
		await syncActiveMissionFile(missionId, 'cancelled', 'Mission cancelled from mission control');
		await syncMissionRecord(missionId, action, 'Mission cancelled from mission control');
		const bridgeEvent = buildBridgeEvent(missionId, 'mission_cancelled', source);
		eventBridge.emit(bridgeEvent);
		void relayMissionControlEvent({
			...bridgeEvent,
			message: 'Mission cancelled from mission control command endpoint'
		});
		return {
			ok: true,
			missionId,
			action,
			message: `Mission ${missionId} cancelled.`
		};
	}

	if (action === 'pause') {
		const runtime = await providerRuntime.pauseMission(missionId);
		if (!runtime.paused) {
			return {
				ok: false,
				missionId,
				action,
				error: runtime.reason || 'Unable to pause mission'
			};
		}
		await syncActiveMissionFile(missionId, 'paused', runtime.reason || 'Mission paused');
		await syncMissionRecord(missionId, action, runtime.reason);
	}

	if (action === 'resume') {
		const runtime = await providerRuntime.resumeMission(missionId);
		if (!runtime.resumed) {
			return {
				ok: false,
				missionId,
				action,
				error: runtime.reason || 'Unable to resume mission'
			};
		}
		await syncActiveMissionFile(missionId, 'running', runtime.reason || 'Mission resumed');
		await syncMissionRecord(missionId, action, runtime.reason);
	}

	const eventType = ACTION_TO_EVENT[action as 'pause' | 'resume'];
	const bridgeEvent = buildBridgeEvent(missionId, eventType, source);
	eventBridge.emit(bridgeEvent);
	void relayMissionControlEvent({
		...bridgeEvent,
		message: action === 'pause' ? 'Mission paused by command endpoint' : 'Mission resumed by command endpoint'
	});

	return {
		ok: true,
		missionId,
		action,
		eventType,
		message: `Mission ${missionId} ${action} command executed.`
	};
}

export function parseDiscordMissionControlCommand(text: string):
	| { ok: true; action: MissionControlAction; missionId: string }
	| { ok: false; error: string; help: string } {
	const normalized = text.trim().replace(/^\//, '');
	const parts = normalized.split(/\s+/).filter(Boolean);
	if (parts.length < 2 || parts[0].toLowerCase() !== 'mission') {
		return {
			ok: false,
			error: 'Command must start with "mission".',
			help: 'Use: mission <status|pause|resume|kill> <missionId>'
		};
	}

	const action = parts[1].toLowerCase();
	if (!isMissionControlAction(action)) {
		return {
			ok: false,
			error: `Unknown mission action "${parts[1]}".`,
			help: 'Use: mission <status|pause|resume|kill> <missionId>'
		};
	}

	const missionId = parts[2] || '';
	if (!missionId) {
		return {
			ok: false,
			error: 'Missing missionId.',
			help: 'Use: mission <status|pause|resume|kill> <missionId>'
		};
	}

	return {
		ok: true,
		action,
		missionId
	};
}
