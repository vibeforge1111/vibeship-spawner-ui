import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { buildMissionControlTrace, missionIdFromRequestId } from './mission-control-trace';

async function writeJson(filePath: string, value: unknown) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function makeStateDir() {
	const stateDir = await mkdtemp(path.join(tmpdir(), 'spawner-trace-unit-'));
	process.env.SPAWNER_STATE_DIR = stateDir;
	return stateDir;
}

afterEach(() => {
	delete process.env.SPAWNER_STATE_DIR;
});

describe('mission-control-trace', () => {
	it('derives stable mission ids from Telegram request ids', () => {
		expect(missionIdFromRequestId('tg-build-8319079055-1638-1777362992971')).toBe(
			'mission-1777362992971'
		);
		expect(missionIdFromRequestId('natural language request')).toBe(
			'mission-natural_language_request'
		);
	});

	it('reports planning from a matching pending Telegram request', async () => {
		const stateDir = await makeStateDir();
		const requestId = 'tg-unit-planning-1777371000000';
		const missionId = 'mission-1777371000000';

		await writeJson(path.join(stateDir, 'pending-request.json'), {
			requestId,
			status: 'processed',
			relay: {
				missionId,
				requestId,
				chatId: 'chat-1',
				userId: 'user-1',
				telegramRelay: { port: 8789, profile: 'spark-agi' }
			}
		});

		const trace = await buildMissionControlTrace({
			requestId,
			getProviderResults: () => []
		});

		expect(trace).toMatchObject({
			requestId,
			missionId,
			phase: 'planning',
			summary: 'Spark is shaping the PRD and preparing the canvas.',
			surfaces: {
				telegram: {
					chatId: 'chat-1',
					userId: 'user-1'
				},
				canvas: {
					pipelineId: null,
					nodeCount: null
				},
				kanban: {
					bucket: null
				}
			}
		});
	});

	it('reports canvas_ready when analysis and canvas artifacts match the request', async () => {
		const stateDir = await makeStateDir();
		const requestId = 'tg-unit-canvas-1777371000001';
		const missionId = 'mission-1777371000001';

		await writeJson(path.join(stateDir, 'results', `${requestId}.json`), {
			requestId,
			success: true,
			projectName: 'Trace Unit Canvas'
		});
		await writeJson(path.join(stateDir, 'last-canvas-load.json'), {
			pipelineId: `prd-${requestId}`,
			pipelineName: 'Trace Unit Canvas',
			autoRun: true,
			nodes: [{ id: 'task-1' }, { id: 'task-2' }],
			relay: { missionId, requestId }
		});

		const trace = await buildMissionControlTrace({
			requestId,
			getProviderResults: () => []
		});

		expect(trace).toMatchObject({
			requestId,
			missionId,
			phase: 'canvas_ready',
			surfaces: {
				canvas: {
					pipelineId: `prd-${requestId}`,
					pipelineName: 'Trace Unit Canvas',
					autoRun: true,
					nodeCount: 2
				}
			}
		});
	});

	it('does not attach unrelated pending or canvas artifacts to a requested trace', async () => {
		const stateDir = await makeStateDir();
		const requestId = 'tg-unit-target-1777371000002';

		await writeJson(path.join(stateDir, 'pending-request.json'), {
			requestId: 'tg-unit-other-1777379999999',
			relay: {
				missionId: 'mission-1777379999999',
				requestId: 'tg-unit-other-1777379999999',
				chatId: 'wrong-chat'
			}
		});
		await writeJson(path.join(stateDir, 'last-canvas-load.json'), {
			pipelineId: 'prd-tg-unit-other-1777379999999',
			nodes: [{ id: 'wrong-node' }],
			relay: {
				missionId: 'mission-1777379999999',
				requestId: 'tg-unit-other-1777379999999'
			}
		});

		const trace = await buildMissionControlTrace({
			requestId,
			getProviderResults: () => []
		});

		expect(trace).toMatchObject({
			requestId,
			missionId: 'mission-1777371000002',
			phase: 'unknown',
			artifacts: {
				pendingRequest: null,
				lastCanvasLoad: null
			},
			surfaces: {
				telegram: { chatId: null, userId: null },
				canvas: { pipelineId: null, nodeCount: null }
			}
		});
	});

	it('treats provider failure as failed even when every provider process is finished', async () => {
		const stateDir = await makeStateDir();
		const requestId = 'tg-unit-failed-1777371000003';
		const missionId = 'mission-1777371000003';

		await writeJson(path.join(stateDir, 'pending-request.json'), {
			requestId,
			relay: { missionId, requestId }
		});

		const trace = await buildMissionControlTrace({
			requestId,
			getProviderResults: () => [],
			getDispatchStatus: () => ({
				allComplete: true,
				anyFailed: true,
				paused: false,
				pausedReason: null,
				lastReason: 'Mission completed with provider failures',
				snapshotAvailable: true,
				resumeable: false,
				resumeBlocker: null,
				providers: { codex: 'failed' }
			})
		});

		expect(trace.phase).toBe('failed');
		expect(trace.summary).toBe('Mission failed.');
		expect(trace.surfaces.dispatch).toMatchObject({
			allComplete: true,
			anyFailed: true,
			providers: { codex: 'failed' }
		});
	});
});
