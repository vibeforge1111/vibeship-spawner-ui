import type { ExecutionStatus } from './mission-executor';

export const MISSION_CONTROL_LIVE_SYNC_INTERVAL_MS = 2_000;

export function shouldLiveSyncMissionControl(status: ExecutionStatus | null | undefined): boolean {
	return status === 'creating' || status === 'running' || status === 'paused';
}

export function shouldSkipMissionControlHydration(input: {
	missionId: string;
	inFlightMissionId: string | null;
	lastHydratedMissionId: string | null;
	currentMissionId: string | null | undefined;
	force?: boolean;
}): boolean {
	if (!input.missionId) return true;
	if (input.inFlightMissionId === input.missionId) return true;
	if (input.force) return false;
	return input.lastHydratedMissionId === input.missionId && input.currentMissionId === input.missionId;
}
