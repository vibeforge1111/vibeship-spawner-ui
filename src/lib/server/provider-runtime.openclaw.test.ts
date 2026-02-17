import { afterEach, describe, expect, it } from 'vitest';
import { providerRuntime } from './provider-runtime';
import { openclawBridge } from '$lib/services/openclaw-bridge';
import { eventBridge, type BridgeEvent } from '$lib/services/event-bridge';
import type { MultiLLMExecutionPack, MultiLLMProviderConfig } from '$lib/services/multi-llm-orchestrator';

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
	providerRuntime.cleanup('mission-step2-success');
	providerRuntime.cleanup('mission-step2-failure');
	providerRuntime.cleanup('mission-step2-cancel');
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
			provider('codex', 'gpt-5.3-codex')
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
			provider('codex', 'gpt-5.3-codex')
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
});
