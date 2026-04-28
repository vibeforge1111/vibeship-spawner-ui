import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	executeMissionControlAction,
	parseDiscordMissionControlCommand
} from './mission-control-command';
import { relayMissionControlEvent } from './mission-control-relay';
import { providerRuntime } from './provider-runtime';
import { mcpClient, type Mission } from '$lib/services/mcp-client';

function missionRecord(id: string): Mission {
	return {
		id,
		user_id: 'test-user',
		name: 'Orphan Pause Mission',
		description: 'Mission exists in storage but has no live provider sessions',
		mode: 'multi-llm-orchestrator',
		status: 'running',
		agents: [{ id: 'agent-1', name: 'Agent', role: 'builder', skills: ['code_analysis'], model: 'sonnet' }],
		tasks: [{
			id: 'task-1',
			title: 'Continue work',
			description: 'Resume from mission store',
			assignedTo: 'agent-1',
			status: 'pending',
			handoffType: 'sequential'
		}],
		context: { projectPath: process.cwd(), projectType: 'typescript', goals: ['pause orphan mission'] },
		current_task_id: null,
		outputs: {},
		error: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		started_at: new Date().toISOString(),
		completed_at: null
	};
}

afterEach(() => {
	vi.restoreAllMocks();
	providerRuntime.cleanup('mission-command-orphan-pause');
});

describe('mission-control-command parser', () => {
	it('parses standard mission command', () => {
		const parsed = parseDiscordMissionControlCommand('mission status mission-123');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.action).toBe('status');
			expect(parsed.missionId).toBe('mission-123');
		}
	});

	it('parses slash command form', () => {
		const parsed = parseDiscordMissionControlCommand('/mission pause abc');
		expect(parsed.ok).toBe(true);
		if (parsed.ok) {
			expect(parsed.action).toBe('pause');
			expect(parsed.missionId).toBe('abc');
		}
	});

	it('returns help when mission id is missing', () => {
		const parsed = parseDiscordMissionControlCommand('mission kill');
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.help).toContain('mission <status|pause|resume|kill> <missionId>');
		}
	});

	it('does not invent status for an unknown mission id', async () => {
		const result = await executeMissionControlAction({
			action: 'status',
			missionId: 'spark-definitely-not-real-status',
			source: 'test'
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain('not found');
	});

	it('does not pause an unknown mission id', async () => {
		const result = await executeMissionControlAction({
			action: 'pause',
			missionId: 'spark-definitely-not-real-pause',
			source: 'test'
		});

		expect(result.ok).toBe(false);
		expect(result.error).toContain('not found');
	});

	it('pauses a board-visible orphan mission by confirming the stored mission record', async () => {
		const missionId = 'mission-command-orphan-pause';
		const getMission = vi.spyOn(mcpClient, 'getMission').mockResolvedValue({
			success: true,
			data: {
				mission: missionRecord(missionId),
				execution_prompt: 'Mission ID: mission-command-orphan-pause',
				_instruction: ''
			}
		});
		const updateMission = vi.spyOn(mcpClient, 'updateMission').mockResolvedValue({ success: true });

		await relayMissionControlEvent({
			type: 'mission_started',
			missionId,
			source: 'spawner-ui',
			data: { mission: { name: 'Orphan Pause Mission' } }
		});

		const result = await executeMissionControlAction({
			action: 'pause',
			missionId,
			source: 'spawner-ui'
		});

		expect(result.ok).toBe(true);
		expect(result.eventType).toBe('mission_paused');
		expect(getMission).toHaveBeenCalledWith(missionId);
		expect(updateMission).toHaveBeenCalledWith(missionId, expect.objectContaining({ status: 'paused' }));

		const status = providerRuntime.getMissionStatus(missionId);
		expect(status.paused).toBe(true);
		expect(status.snapshotAvailable).toBe(false);
	});

	it('marks killed board-visible missions as cancelled rather than failed', async () => {
		const missionId = 'mission-command-cancelled';
		const failMission = vi.spyOn(mcpClient, 'failMission').mockResolvedValue({
			success: true,
			data: {
				success: true,
				mission: missionRecord(missionId),
				_instruction: ''
			}
		});

		await relayMissionControlEvent({
			type: 'mission_created',
			missionId,
			missionName: 'Cancel Me',
			source: 'spawner-ui'
		});

		const result = await executeMissionControlAction({
			action: 'kill',
			missionId,
			source: 'spawner-ui'
		});

		expect(result.ok).toBe(true);
		expect(result.message).toContain('cancelled');
		expect(failMission).toHaveBeenCalledWith(missionId, 'Mission cancelled from mission control');
	});
});
