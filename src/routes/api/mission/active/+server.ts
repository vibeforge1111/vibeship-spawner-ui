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
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SPAWNER_DIR = '.spawner';
const ACTIVE_MISSION_FILE = 'active-mission.json';

interface ActiveMissionState {
	missionId: string;
	missionName: string;
	status: 'running' | 'paused' | 'creating';
	progress: number;
	currentTaskId: string | null;
	currentTaskName: string | null;
	executionPrompt: string;
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
		const projectRoot = process.cwd();
		const missionPath = path.join(projectRoot, SPAWNER_DIR, ACTIVE_MISSION_FILE);

		if (!existsSync(missionPath)) {
			return json({
				active: false,
				message: 'No active mission found'
			});
		}

		const content = await readFile(missionPath, 'utf-8');
		const state: ActiveMissionState = JSON.parse(content);

		// Check if mission is stale (no update in 30 minutes)
		const lastUpdated = new Date(state.lastUpdated);
		const minutesSinceUpdate = (Date.now() - lastUpdated.getTime()) / 60000;
		const isStale = minutesSinceUpdate > 30;

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
		const projectRoot = process.cwd();
		const spawnerDir = path.join(projectRoot, SPAWNER_DIR);
		const missionPath = path.join(spawnerDir, ACTIVE_MISSION_FILE);

		// Ensure .spawner directory exists
		if (!existsSync(spawnerDir)) {
			await mkdir(spawnerDir, { recursive: true });
		}

		// Build the state object
		const state: ActiveMissionState = {
			missionId: body.missionId,
			missionName: body.missionName || 'Unnamed Mission',
			status: body.status || 'running',
			progress: body.progress || 0,
			currentTaskId: body.currentTaskId || null,
			currentTaskName: body.currentTaskName || null,
			executionPrompt: body.executionPrompt || '',
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
		const projectRoot = process.cwd();
		const missionPath = path.join(projectRoot, SPAWNER_DIR, ACTIVE_MISSION_FILE);

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

	instructions += `### How to Resume
1. Report task start: POST to /api/events with type "task_started"
2. Report progress: POST to /api/events with type "task_progress"
3. Report completion: POST to /api/events with type "task_completed"

**Base URL**: http://localhost:5173
`;

	return instructions;
}
