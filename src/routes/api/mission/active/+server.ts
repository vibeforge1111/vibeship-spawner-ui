/**
 * Active Mission API Endpoint
 *
 * Provides mission state for Claude Code to:
 * 1. Check if there's an active mission to resume
 * 2. Get the execution prompt and task list
 * 3. Know current progress and completed tasks
 *
 * This enables resilient execution that survives interruptions.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { MultiLLMExecutionPack } from '$lib/services/multi-llm-orchestrator';
import { spawnerStateDir } from '$lib/server/spawner-state';

const ACTIVE_MISSION_FILE = 'active-mission.json';
const TERMINAL_MISSION_EVENTS = new Set(['mission_completed', 'mission_failed', 'mission_paused']);

function getSpawnerDir(): string {
	return spawnerStateDir();
}

function getActiveMissionPath(): string {
	return path.join(getSpawnerDir(), ACTIVE_MISSION_FILE);
}

function getMissionControlPath(): string {
	return path.join(getSpawnerDir(), 'mission-control.json');
}

async function missionHasTerminalRelayEvent(missionId: string | undefined): Promise<boolean> {
	if (!missionId) return false;
	const missionControlPath = getMissionControlPath();
	if (!existsSync(missionControlPath)) return false;

	try {
		const raw = await readFile(missionControlPath, 'utf-8');
		const parsed = JSON.parse(raw) as {
			recent?: Array<{ eventType?: unknown; missionId?: unknown }>;
		};
		return (parsed.recent || []).some(
			(entry) =>
				entry.missionId === missionId &&
				typeof entry.eventType === 'string' &&
				TERMINAL_MISSION_EVENTS.has(entry.eventType)
		);
	} catch {
		return false;
	}
}

interface ActiveMissionState {
	missionId: string;
	missionName: string;
	status: 'running' | 'paused' | 'creating';
	progress: number;
	currentTaskId: string | null;
	currentTaskName: string | null;
	executionPrompt: string;
	multiLLMExecution?: MultiLLMExecutionPack | null;
	tasks: Array<{
		id: string;
		title: string;
		status: 'pending' | 'in_progress' | 'completed' | 'failed';
		skills: string[];
	}>;
	completedTasks: string[];
	failedTasks: string[];
	lastUpdated: string;
	resumeInstructions: string;
}

/**
 * GET /api/mission/active
 * Returns the active mission state if one exists
 */
export const GET: RequestHandler = async ({ url }) => {
	try {
		const missionPath = getActiveMissionPath();

		if (!existsSync(missionPath)) {
			return json({
				active: false,
				message: 'No active mission found'
			});
		}

		const content = await readFile(missionPath, 'utf-8');
		const state: ActiveMissionState = JSON.parse(content);

		if (await missionHasTerminalRelayEvent(state.missionId)) {
			await unlink(missionPath).catch(() => undefined);
			return json({
				active: false,
				terminal: true,
				message: 'Active mission was already terminal in Mission Control history and was cleared.'
			});
		}

		// Check if mission is stale (no update in 30 minutes)
		const lastUpdated = new Date(state.lastUpdated);
		const minutesSinceUpdate = (Date.now() - lastUpdated.getTime()) / 60000;
		const isStale = minutesSinceUpdate > 30;
		const includeStale =
			url.searchParams.get('includeStale') === '1' ||
			url.searchParams.get('includeStale') === 'true';

		if (isStale && !includeStale) {
			return json({
				active: false,
				stale: true,
				minutesSinceUpdate: Math.round(minutesSinceUpdate),
				staleMission: {
					id: state.missionId,
					name: state.missionName,
					status: state.status,
					progress: state.progress,
					currentTask: state.currentTaskId ? {
						id: state.currentTaskId,
						name: state.currentTaskName
					} : null
				},
				message: 'Active mission state is stale. Pass includeStale=1 to inspect it.'
			});
		}

		return json({
			active: true,
			stale: isStale,
			minutesSinceUpdate: Math.round(minutesSinceUpdate),
			mission: {
				id: state.missionId,
				name: state.missionName,
				status: state.status,
				progress: state.progress,
				currentTask: state.currentTaskId ? {
					id: state.currentTaskId,
					name: state.currentTaskName
				} : null
			},
			tasks: state.tasks,
			completedTasks: state.completedTasks,
			failedTasks: state.failedTasks,
			multiLLMExecution: state.multiLLMExecution || null,
			executionPrompt: state.executionPrompt,
			resumeInstructions: state.resumeInstructions,
			lastUpdated: state.lastUpdated
		});
	} catch (error) {
		console.error('Failed to read active mission:', error);
		return json({
			active: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

/**
 * POST /api/mission/active
 * Update the active mission state (called by UI when state changes)
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const spawnerDir = getSpawnerDir();
		const missionPath = getActiveMissionPath();
		const status = typeof body.status === 'string' ? body.status : 'running';

		if (status === 'completed' || status === 'failed' || status === 'cancelled') {
			if (existsSync(missionPath)) {
				await unlink(missionPath);
			}
			return json({
				success: true,
				active: false,
				message: 'Terminal mission state cleared'
			});
		}

		if (await missionHasTerminalRelayEvent(body.missionId)) {
			if (existsSync(missionPath)) {
				await unlink(missionPath);
			}
			return json({
				success: true,
				active: false,
				terminal: true,
				message: 'Ignored stale active mission update because Mission Control already has a terminal event.'
			});
		}

		// Ensure .spawner directory exists
		if (!existsSync(spawnerDir)) {
			await mkdir(spawnerDir, { recursive: true });
		}

		// Build the state object
		const state: ActiveMissionState = {
			missionId: body.missionId,
			missionName: body.missionName || 'Unnamed Mission',
			status: status === 'paused' || status === 'creating' ? status : 'running',
			progress: body.progress || 0,
			currentTaskId: body.currentTaskId || null,
			currentTaskName: body.currentTaskName || null,
			executionPrompt: body.executionPrompt || '',
			multiLLMExecution: body.multiLLMExecution || null,
			tasks: body.tasks || [],
			completedTasks: body.completedTasks || [],
			failedTasks: body.failedTasks || [],
			lastUpdated: new Date().toISOString(),
			resumeInstructions: generateResumeInstructions(body)
		};

		await writeFile(missionPath, JSON.stringify(state, null, 2));

		return json({
			success: true,
			message: 'Mission state saved',
			path: missionPath
		});
	} catch (error) {
		console.error('Failed to save active mission:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

/**
 * DELETE /api/mission/active
 * Clear the active mission (when completed, cancelled, or user clears)
 */
export const DELETE: RequestHandler = async () => {
	try {
		const missionPath = getActiveMissionPath();

		if (existsSync(missionPath)) {
			const { unlink } = await import('fs/promises');
			await unlink(missionPath);
		}

		return json({
			success: true,
			message: 'Active mission cleared'
		});
	} catch (error) {
		console.error('Failed to clear active mission:', error);
		return json({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 500 });
	}
};

/**
 * Generate resume instructions for Claude Code
 */
function generateResumeInstructions(state: {
	missionId?: string;
	missionName?: string;
	currentTaskId?: string;
	currentTaskName?: string;
	completedTasks?: string[];
	tasks?: Array<{ id: string; title: string; status: string; skills: string[] }>;
	multiLLMExecution?: MultiLLMExecutionPack | null;
}): string {
	const completedCount = state.completedTasks?.length || 0;
	const totalTasks = state.tasks?.length || 0;
	const pendingTasks = state.tasks?.filter(t => t.status === 'pending' || t.status === 'in_progress') || [];

	let instructions = `## Resume Instructions

**Mission**: ${state.missionName || 'Unknown'} (${state.missionId || 'no-id'})
**Progress**: ${completedCount}/${totalTasks} tasks completed

`;

	if (state.currentTaskId && state.currentTaskName) {
		instructions += `### Current Task (In Progress)
- **Task**: ${state.currentTaskName}
- **ID**: ${state.currentTaskId}

Continue from where you left off on this task.

`;
	}

	if (pendingTasks.length > 0) {
		instructions += `### Remaining Tasks
`;
		for (const task of pendingTasks) {
			const skillsNote = task.skills?.length > 0 ? ` (skills: ${task.skills.join(', ')})` : '';
			instructions += `- [ ] ${task.title}${skillsNote}\n`;
		}
		instructions += '\n';
	}

	if (state.multiLLMExecution?.enabled) {
		const providerList = state.multiLLMExecution.providers
			.map((provider) => `- ${provider.label} (${provider.id}): ${provider.model}`)
			.join('\n');
		instructions += `### Multi-LLM Orchestrator
Strategy: ${state.multiLLMExecution.strategy}
Primary Provider: ${state.multiLLMExecution.primaryProviderId}

Providers:
${providerList}

Resume by loading provider-specific prompts from mission state and continue emitting events to /api/events.

`;
	}

	instructions += `### How to Resume
1. Report task start: POST to /api/events with type "task_started"
2. Report progress: POST to /api/events with type "task_progress"
3. Report completion: POST to /api/events with type "task_completed"

**Base URL**: http://localhost:3333
`;

	return instructions;
}
