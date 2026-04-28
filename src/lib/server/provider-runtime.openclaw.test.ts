import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerRuntime } from './provider-runtime';
import { openclawBridge } from '$lib/services/openclaw-bridge';
import { eventBridge, type BridgeEvent } from '$lib/services/event-bridge';
import type { MultiLLMExecutionPack, MultiLLMProviderConfig } from '$lib/services/multi-llm-orchestrator';
import { mcpClient, type Mission } from '$lib/services/mcp-client';

function provider(id: 'claude' | 'codex', model: string): MultiLLMProviderConfig {
	return {
		id,
		label: id === 'claude' ? 'Claude' : 'Codex',
		model,
		enabled: true,
		kind: 'terminal_cli',
		eventSource: id,
		requiresApiKey: true,
		apiKeyEnv: id === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY',
		commandTemplate: id === 'claude' ? 'claude --model {model}' : 'codex exec --model {model}'
	};
}

function buildPack(missionId: string, providers: MultiLLMProviderConfig[]): MultiLLMExecutionPack {
	return {
		enabled: true,
		strategy: providers.length > 1 ? 'round_robin' : 'single',
		primaryProviderId: providers[0].id,
		providers,
		assignments: Object.fromEntries(
			providers.map((p) => [p.id, { providerId: p.id, mode: 'execute' as const, taskIds: ['task-1'] }])
		),
		mcpTaskPlans: {},
		blockedTaskIds: [],
		masterPrompt: `Mission ID: ${missionId}`,
		providerPrompts: Object.fromEntries(
			providers.map((p) => [p.id, `Mission ID: ${missionId}\nProvider: ${p.id}\nDo work`])
		),
		launchCommands: Object.fromEntries(providers.map((p) => [p.id, `run ${p.id}`])),
		createdAt: new Date().toISOString()
	};
}

async function waitFor(fn: () => boolean, timeoutMs = 1500): Promise<void> {
	const start = Date.now();
	while (!fn()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('Timed out waiting for condition');
		}
		await new Promise((r) => setTimeout(r, 25));
	}
}

afterEach(() => {
	openclawBridge.resetForTests();
	vi.restoreAllMocks();
	providerRuntime.cleanup('mission-step2-success');
	providerRuntime.cleanup('mission-step2-failure');
	providerRuntime.cleanup('mission-step2-cancel');
	providerRuntime.cleanup('mission-step2-rebuild');
	providerRuntime.cleanup('mission-step2-persist');
	providerRuntime.cleanup('mission-step2-lifecycle');
});

describe('provider-runtime openclaw bridge', () => {
	it('dispatches codex + claude through openclaw worker sessions and emits normalized events', async () => {
		openclawBridge.setWorkerExecutorForTests(async (context) => {
			context.emitProgress(35, `${context.providerId} booting`);
			context.emitProgress(80, `${context.providerId} running`);
			return { success: true, response: `${context.providerId}-ok` };
		});

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		const pack = buildPack('mission-step2-success', [
			provider('claude', 'claude-opus-4-1'),
			provider('codex', 'gpt-5.5')
		]);

		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { claude: 'test-claude', codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-success').allComplete);

		unsubscribe();
		const status = providerRuntime.getMissionStatus('mission-step2-success');
		expect(status.providers.claude).toBe('completed');
		expect(status.providers.codex).toBe('completed');

		const normalized = emitted.filter((event) => event.data?.openclawSessionId);
		expect(normalized.some((event) => event.type === 'task_started')).toBe(true);
		expect(normalized.some((event) => event.type === 'task_progress')).toBe(true);
		expect(normalized.some((event) => event.type === 'task_completed')).toBe(true);
		for (const event of normalized) {
			expect(event.data?.missionId).toBe('mission-step2-success');
			expect(typeof event.data?.providerId).toBe('string');
			expect(typeof event.data?.openclawSessionId).toBe('string');
		}
	});

	it('marks provider failures deterministically and emits task_failed', async () => {
		openclawBridge.setWorkerExecutorForTests(async (context) => {
			if (context.providerId === 'claude') {
				context.emitProgress(20, 'claude failed while booting');
				return { success: false, error: 'Claude worker crashed' };
			}
			return { success: true, response: 'codex-ok' };
		});

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		const pack = buildPack('mission-step2-failure', [
			provider('claude', 'claude-opus-4-1'),
			provider('codex', 'gpt-5.5')
		]);

		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { claude: 'test-claude', codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-failure').allComplete);
		unsubscribe();

		const status = providerRuntime.getMissionStatus('mission-step2-failure');
		expect(status.anyFailed).toBe(true);
		expect(status.providers.claude).toBe('failed');
		expect(emitted.some((event) => event.type === 'task_failed')).toBe(true);
	});

	it('cancels an active worker session and emits task_cancelled', async () => {
		openclawBridge.setWorkerExecutorForTests(
			(context) =>
				new Promise((resolve) => {
					context.emitProgress(15, `${context.providerId} waiting`);
					const timer = setTimeout(() => resolve({ success: true, response: 'unexpected' }), 2000);
					context.signal?.addEventListener(
						'abort',
						() => {
							clearTimeout(timer);
							resolve({ success: false, error: 'Cancelled' });
						},
						{ once: true }
					);
				})
		);

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		const pack = buildPack('mission-step2-cancel', [provider('claude', 'claude-opus-4-1')]);
		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { claude: 'test-claude' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await new Promise((r) => setTimeout(r, 50));
		await providerRuntime.cancelMission('mission-step2-cancel');
		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-cancel').providers.claude === 'cancelled');

		unsubscribe();
		expect(emitted.some((event) => event.type === 'task_cancelled')).toBe(true);
	});

	it('rebuilds dispatch snapshot from mission record when resuming a paused orphan mission', async () => {
		openclawBridge.setWorkerExecutorForTests(async (context) => {
			context.emitProgress(40, `${context.providerId} resumed`);
			return { success: true, response: `${context.providerId}-resumed` };
		});

		const mission: Mission = {
			id: 'mission-step2-rebuild',
			user_id: 'test-user',
			name: 'Resume Rebuild Mission',
			description: 'Validate resume fallback reconstruction',
			mode: 'multi-llm-orchestrator',
			status: 'paused',
			agents: [
				{ id: 'agent-1', name: 'Agent', role: 'builder', skills: ['code_analysis'], model: 'sonnet' }
			],
			tasks: [
				{
					id: 'task-1',
					title: 'Rebuild and resume',
					description: 'Resume mission from reconstructed execution pack',
					assignedTo: 'agent-1',
					status: 'pending',
					handoffType: 'sequential'
				}
			],
			context: {
				projectPath: process.cwd(),
				projectType: 'typescript',
				goals: ['prove resume reconstruction']
			},
			current_task_id: null,
			outputs: {},
			error: null,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			started_at: null,
			completed_at: null
		};

		const missionSpy = vi.spyOn(mcpClient, 'getMission').mockResolvedValue({
			success: true,
			data: {
				mission,
				execution_prompt: 'Mission ID: mission-step2-rebuild',
				_instruction: ''
			}
		});

		const pauseResult = await providerRuntime.pauseMission('mission-step2-rebuild');
		expect(pauseResult.paused).toBe(true);
		const before = providerRuntime.getMissionStatus('mission-step2-rebuild');
		expect(before.paused).toBe(true);
		expect(before.snapshotAvailable).toBe(false);

		const resumed = await providerRuntime.resumeMission('mission-step2-rebuild');
		expect(resumed.resumed).toBe(true);
		expect(missionSpy).toHaveBeenCalledWith('mission-step2-rebuild');

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-rebuild').allComplete);
		const after = providerRuntime.getMissionStatus('mission-step2-rebuild');
		expect(after.snapshotAvailable).toBe(true);
		expect(after.paused).toBe(false);
		expect(Object.keys(after.providers).length).toBeGreaterThan(0);
	});

	it('keeps provider result details after in-memory sessions are cleared', async () => {
		openclawBridge.setWorkerExecutorForTests(async (context) => {
			return { success: true, response: `${context.providerId}-durable`, durationMs: 12 };
		});

		const pack = buildPack('mission-step2-persist', [provider('codex', 'gpt-5.5')]);
		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-persist').allComplete);
		expect(providerRuntime.getMissionResults('mission-step2-persist')[0]).toMatchObject({
			providerId: 'codex',
			status: 'completed',
			response: 'codex-durable'
		});
		expect(providerRuntime.getMissionResults('mission-step2-persist')[0].durationMs).toEqual(expect.any(Number));

		providerRuntime.clearInMemoryForTests('mission-step2-persist');
		expect(providerRuntime.getMissionStatus('mission-step2-persist')).toMatchObject({
			allComplete: true,
			providers: { codex: 'completed' }
		});
		expect(providerRuntime.getSessionsForMission('mission-step2-persist')).toEqual([]);
		expect(providerRuntime.getMissionResults('mission-step2-persist')[0]).toMatchObject({
			providerId: 'codex',
			status: 'completed',
			response: 'codex-durable'
		});
		expect(providerRuntime.getMissionResults('mission-step2-persist')[0].durationMs).toEqual(expect.any(Number));
	});

	it('reconciles running provider sessions from external mission lifecycle completion', async () => {
		openclawBridge.setWorkerExecutorForTests(
			() =>
				new Promise(() => {
					// Simulate a CLI worker whose process exits after it has already posted lifecycle events.
				})
		);

		const pack = buildPack('mission-step2-lifecycle', [provider('codex', 'gpt-5.5')]);
		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		expect(providerRuntime.getMissionStatus('mission-step2-lifecycle').providers.codex).toBe('running');

		providerRuntime.markMissionTerminalFromLifecycleEvent({
			missionId: 'mission-step2-lifecycle',
			providerId: 'codex',
			status: 'completed',
			response: 'completed from event stream',
			completedAt: '2026-04-28T00:00:00.000Z'
		});

		const status = providerRuntime.getMissionStatus('mission-step2-lifecycle');
		expect(status.allComplete).toBe(true);
		expect(status.providers.codex).toBe('completed');
		expect(status.lastReason).toBe('Mission completed from lifecycle event');
		expect(providerRuntime.getMissionResults('mission-step2-lifecycle')[0]).toMatchObject({
			providerId: 'codex',
			status: 'completed',
			response: 'completed from event stream',
			completedAt: '2026-04-28T00:00:00.000Z'
		});
	});
});
