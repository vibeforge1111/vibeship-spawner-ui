import { describe, expect, it } from 'vitest';
import {
	buildCanvasMissionStatusUpdates,
	canvasStatusForMissionControlTask,
	findMissionControlBoardEntryForCanvas,
	taskMatchesCanvasNode
} from './canvas-mission-status';
import type { CanvasNode } from '$lib/stores/canvas.svelte';
import type { MissionControlBoardEntry } from '$lib/types/mission-control';

function node(id: string, name: string, skillId = id): CanvasNode {
	return {
		id,
		skillId,
		skill: {
			id: skillId,
			name,
			description: '',
			category: 'development',
			tier: 'free',
			tags: [],
			triggers: []
		},
		position: { x: 0, y: 0 },
		status: 'idle'
	};
}

function boardEntry(
	missionId: string,
	missionName: string,
	lastUpdated: string,
	status: MissionControlBoardEntry['status'] = 'completed'
): MissionControlBoardEntry {
	return {
		missionId,
		missionName,
		status,
		lastEventType: status === 'completed' ? 'mission_completed' : 'task_started',
		lastUpdated,
		queuedAt: null,
		startedAt: null,
		lastSummary: '',
		taskName: null,
		taskCount: 1,
		taskNames: ['Create the playable game shell'],
		taskStatusCounts: {
			queued: 0,
			running: 0,
			completed: status === 'completed' ? 1 : 0,
			failed: 0,
			cancelled: 0,
			total: 1
		},
		tasks: [{ title: 'Create the playable game shell', skills: ['frontend'], status: 'completed' }]
	};
}

describe('canvas mission status mapping', () => {
	it('matches board task titles to canvas nodes and maps task statuses', () => {
		const updates = buildCanvasMissionStatusUpdates(
			[
				node('node-1', 'Create the playable game shell'),
				node('node-2', 'Design the core play and reasoning loop')
			],
			[
				{ title: 'Create the playable game shell', skills: [], status: 'completed' },
				{ title: 'Design the core play and reasoning loop', skills: [], status: 'running' }
			]
		);

		expect(updates).toEqual([
			{ nodeId: 'node-1', status: 'success', taskTitle: 'Create the playable game shell' },
			{ nodeId: 'node-2', status: 'running', taskTitle: 'Design the core play and reasoning loop' }
		]);
	});

	it('uses the same fuzzy task matching for mission history and canvas-only hydration', () => {
		expect(taskMatchesCanvasNode(node('node-1', 'task-2: Build UI'), 'task-2', 'Build UI')).toBe(true);
		expect(taskMatchesCanvasNode(node('node-2', 'Verify the playable loop'), 'Verify the playable loop')).toBe(true);
	});

	it('keeps terminal task states visible on the canvas', () => {
		expect(canvasStatusForMissionControlTask('completed')).toBe('success');
		expect(canvasStatusForMissionControlTask('failed')).toBe('error');
		expect(canvasStatusForMissionControlTask('cancelled')).toBe('error');
		expect(canvasStatusForMissionControlTask('queued')).toBe('queued');
	});

	it('finds the matching board entry from a mission-scoped pipeline id', () => {
		const latest = boardEntry(
			'mission-1778837950386',
			'Recursive Sage Maze Game',
			'2026-05-15T08:30:00.000Z'
		);

		const match = findMissionControlBoardEntryForCanvas(
			{
				completed: [
					boardEntry('mission-1778694222688', 'Recursive Sage Maze Game', '2026-05-15T07:00:00.000Z', 'failed'),
					latest
				]
			},
			{ pipelineId: 'prd-tg-build-7c6237150ef0-1778837910898-clarified-1778837950386' }
		);

		expect(match).toBe(latest);
	});

	it('falls back to the latest mission when only the pipeline name is available', () => {
		const latest = boardEntry(
			'mission-1778837950386',
			'Recursive Sage Maze Game',
			'2026-05-15T08:30:00.000Z'
		);

		const match = findMissionControlBoardEntryForCanvas(
			{
				completed: [
					boardEntry('mission-1778694222688', 'Recursive Sage Maze Game', '2026-05-15T07:00:00.000Z', 'failed'),
					latest
				]
			},
			{ pipelineName: 'Recursive Sage Maze Game' }
		);

		expect(match).toBe(latest);
	});
});
