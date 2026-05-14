import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerRuntime, reconcileStaleProviderResults } from './provider-runtime';
import { sparkAgentBridge } from '$lib/services/spark-agent-bridge';
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
	sparkAgentBridge.resetForTests();
	vi.restoreAllMocks();
	providerRuntime.cleanup('mission-step2-success');
	providerRuntime.cleanup('mission-step2-failure');
	providerRuntime.cleanup('mission-step2-cancel');
	providerRuntime.cleanup('mission-step2-pause');
	providerRuntime.cleanup('mission-step2-rebuild');
	providerRuntime.cleanup('mission-step2-persist');
	providerRuntime.cleanup('mission-step2-lifecycle');
	providerRuntime.cleanup('mission-step2-activity');
	providerRuntime.cleanup('mission-step2-response-failure');
	providerRuntime.cleanup('mission-step2-sandbox');
});

describe('provider-runtime Spark agent bridge', () => {
	it('reconciles persisted running provider results once they outlive the worker timeout', () => {
		const startedAt = Date.parse('2026-04-29T10:00:00.000Z');
		const result = reconcileStaleProviderResults(
			[
				{
					providerId: 'codex',
					status: 'running',
					response: null,
					error: null,
					durationMs: null,
					tokenUsage: null,
					startedAt: new Date(startedAt).toISOString(),
					completedAt: null
				}
			],
			{ now: startedAt + 3_600_000, staleMs: 30_000 }
		);

		expect(result.changed).toBe(true);
		expect(result.results[0]).toMatchObject({
			providerId: 'codex',
			status: 'failed',
			durationMs: 3_600_000,
			completedAt: '2026-04-29T11:00:00.000Z'
		});
		expect(result.results[0].error).toContain('Provider runtime went quiet');
	});

	it('leaves fresh persisted running provider results alone', () => {
		const startedAt = Date.parse('2026-04-29T10:00:00.000Z');
		const result = reconcileStaleProviderResults(
			[
				{
					providerId: 'codex',
					status: 'running',
					response: null,
					error: null,
					durationMs: null,
					tokenUsage: null,
					startedAt: new Date(startedAt).toISOString(),
					completedAt: null
				}
			],
			{ now: startedAt + 10_000, staleMs: 30_000 }
		);

		expect(result.changed).toBe(false);
		expect(result.results[0].status).toBe('running');
	});

	it('dispatches codex + claude through Spark agent worker sessions and emits normalized events', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
			context.emitProgress(35, `${context.providerId} booting`);
			context.emitProgress(80, `${context.providerId} running`);
			return { success: true, response: `${context.providerId}-ok` };
		});

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		const pack = buildPack('mission-step2-success', [
			provider('claude', 'opus'),
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

		const normalized = emitted.filter((event) => event.data?.sparkAgentSessionId);
		expect(normalized.some((event) => event.type === 'task_started')).toBe(true);
		expect(normalized.some((event) => event.type === 'task_progress')).toBe(true);
		expect(normalized.some((event) => event.type === 'task_completed')).toBe(true);
		for (const event of normalized) {
			expect(event.data?.missionId).toBe('mission-step2-success');
			expect(typeof event.data?.providerId).toBe('string');
			expect(typeof event.data?.sparkAgentSessionId).toBe('string');
		}
	});

	it('passes explicit workspace-write sandboxing to Codex workers', async () => {
		let observedCommandTemplate = '';
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
			observedCommandTemplate = context.commandTemplate;
			return { success: true, response: 'codex-ok' };
		});

		await providerRuntime.dispatch({
			executionPack: buildPack('mission-step2-sandbox', [provider('codex', 'gpt-5.5')]),
			apiKeys: { codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-sandbox').allComplete);
		expect(observedCommandTemplate).toBe('codex exec --model gpt-5.5 --sandbox workspace-write');
	});

	it('emits assigned task activity immediately for server-side auto-dispatch', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async () => {
			return { success: true, response: 'codex-ok' };
		});

		const emitted: BridgeEvent[] = [];
		const pack = buildPack('mission-step2-activity', [provider('codex', 'gpt-5.5')]);
		pack.assignments.codex = {
			providerId: 'codex',
			mode: 'execute',
			taskIds: ['task-1', 'task-2']
		};
		pack.mcpTaskPlans = {
			'task-1': {
				taskId: 'task-1',
				taskTitle: 'Create the project shell',
				status: 'not_needed',
				requiredCapabilities: [],
				toolCalls: []
			}
		};

		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { codex: 'test-codex' },
			onEvent: (event) => emitted.push(event),
			workingDirectory: process.cwd()
		});

		expect(emitted).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: 'task_started',
					taskId: 'task-1',
					taskName: 'Create the project shell',
					source: 'codex'
				}),
				expect.objectContaining({
					type: 'task_progress',
					taskId: 'task-1',
					taskName: 'Create the project shell',
					source: 'codex',
					progress: expect.any(Number),
					data: expect.objectContaining({
						kind: 'provider_heartbeat',
						suppressRelay: true,
						assignedTaskIds: ['task-1', 'task-2'],
						assignedTaskCount: 2,
						elapsedMs: expect.any(Number)
					})
				})
			])
		);
		const activityProgress = emitted.find(
			(event) =>
				event.type === 'task_progress' &&
				event.taskId === 'task-1' &&
				event.data?.assignedTaskCount === 2
		);
		expect(activityProgress?.message).toContain('working through 2 task pack');
		expect(activityProgress?.message).not.toContain('elapsed');
		expect(activityProgress?.message).not.toContain('estimate adjusting');
		expect(activityProgress?.message).not.toContain('left');
		expect(activityProgress?.data).not.toHaveProperty('estimatedRemainingMs');
		expect(activityProgress?.data).not.toHaveProperty('estimatedDurationMs');
		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-activity').allComplete);
	});

	it('marks provider failures deterministically and emits task_failed', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
			if (context.providerId === 'claude') {
				context.emitProgress(20, 'claude failed while booting');
				return { success: false, error: 'Claude worker crashed' };
			}
			return { success: true, response: 'codex-ok' };
		});

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		const pack = buildPack('mission-step2-failure', [
			provider('claude', 'opus'),
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

	it('uses failed worker response text when no explicit error is returned', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async () => ({
			success: false,
			response: 'Blocked by session permissions. The workspace is mounted read-only.'
		}));

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		await providerRuntime.dispatch({
			executionPack: buildPack('mission-step2-response-failure', [provider('codex', 'gpt-5.5')]),
			apiKeys: { codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-response-failure').allComplete);
		unsubscribe();

		const failures = emitted.filter((event) => event.type === 'task_failed');
		expect(failures.some((event) => event.message?.includes('Blocked by session permissions'))).toBe(true);
		expect(
			failures.some((event) => {
				const data = event.data as Record<string, unknown>;
				const error = data.error as { message?: string } | undefined;
				return error?.message === 'Blocked by session permissions. The workspace is mounted read-only.' &&
					data.response === 'Blocked by session permissions. The workspace is mounted read-only.';
			})
		).toBe(true);
	});

	it('reclassifies successful worker responses that report blocked execution', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async () => ({
			success: true,
			response: 'Blocked by session permissions. No files were created because the workspace is mounted read-only.'
		}));

		const emitted: BridgeEvent[] = [];
		const unsubscribe = eventBridge.subscribe((event) => emitted.push(event));

		await providerRuntime.dispatch({
			executionPack: buildPack('mission-step2-blocked-success', [provider('codex', 'gpt-5.5')]),
			apiKeys: { codex: 'test-codex' },
			onEvent: () => {},
			workingDirectory: process.cwd()
		});

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-blocked-success').allComplete);
		unsubscribe();

		const status = providerRuntime.getMissionStatus('mission-step2-blocked-success');
		expect(status.anyFailed).toBe(true);
		expect(status.providers.codex).toBe('failed');
		const failures = emitted.filter((event) => event.type === 'task_failed');
		expect(failures.some((event) => event.message?.includes('Blocked by session permissions'))).toBe(true);
	});

	it('cancels an active worker session and emits task_cancelled', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(
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

		const pack = buildPack('mission-step2-cancel', [provider('claude', 'opus')]);
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

	it('pauses without emitting terminal completion or failure lifecycle events', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(
			(context) =>
				new Promise((resolve) => {
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
		const pack = buildPack('mission-step2-pause', [provider('codex', 'gpt-5.5')]);
		await providerRuntime.dispatch({
			executionPack: pack,
			apiKeys: { codex: 'test-codex' },
			onEvent: (event) => emitted.push(event),
			workingDirectory: process.cwd()
		});

		await new Promise((r) => setTimeout(r, 50));
		const paused = await providerRuntime.pauseMission('mission-step2-pause');
		expect(paused.paused).toBe(true);
		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-pause').providers.codex === 'cancelled');

		expect(providerRuntime.getMissionStatus('mission-step2-pause').paused).toBe(true);
		expect(emitted.some((event) => event.type === 'task_failed')).toBe(false);
		expect(emitted.some((event) => event.type === 'mission_completed')).toBe(false);
		expect(emitted.some((event) => event.type === 'mission_failed')).toBe(false);
		expect(emitted.some((event) => event.type === 'mission_cancelled')).toBe(false);
	});

	it('rebuilds dispatch snapshot from mission record when resuming a paused orphan mission', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
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

		const resumedEvents: BridgeEvent[] = [];
		const resumed = await providerRuntime.resumeMission('mission-step2-rebuild', (event) => resumedEvents.push(event));
		expect(resumed.resumed).toBe(true);
		expect(missionSpy).toHaveBeenCalledWith('mission-step2-rebuild');
		expect(resumedEvents.some((event) => event.type === 'dispatch_started')).toBe(true);

		await waitFor(() => providerRuntime.getMissionStatus('mission-step2-rebuild').allComplete);
		const after = providerRuntime.getMissionStatus('mission-step2-rebuild');
		expect(after.snapshotAvailable).toBe(true);
		expect(after.paused).toBe(false);
		expect(Object.keys(after.providers).length).toBeGreaterThan(0);
	});

	it('keeps provider result details after in-memory sessions are cleared', async () => {
		sparkAgentBridge.setWorkerExecutorForTests(async (context) => {
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
		sparkAgentBridge.setWorkerExecutorForTests(
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
