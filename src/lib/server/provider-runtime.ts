/**
 * Provider Runtime Manager
 *
 * Singleton that manages concurrent LLM provider execution sessions.
 * Routes tasks to the correct provider client (OpenAI-compat for API providers,
 * terminal CLI for local tools like Claude and Codex).
 */

import type { BridgeEvent } from '$lib/services/event-bridge';
import type {
	MultiLLMExecutionPack,
	MultiLLMProviderConfig
} from '$lib/services/multi-llm-orchestrator';
import type {
	ProviderResult,
	ProviderSession,
	ProviderSessionStatus
} from './provider-clients/types';
import { createBridgeEvent } from './provider-clients/types';
import {
	executeOpenAICompatRequest,
	type OpenAICompatOptions
} from './provider-clients/openai-compat-client';
import {
	executeCodexCliRequest as executeTerminalCliRequest,
	type CodexCliOptions as TerminalCliOptions
} from './provider-clients/codex-cli-client';

export interface DispatchOptions {
	executionPack: MultiLLMExecutionPack;
	apiKeys: Record<string, string>;
	workingDirectory?: string;
	onEvent: (event: BridgeEvent) => void;
}

export interface DispatchResult {
	success: boolean;
	missionId: string;
	sessions: Record<string, { status: ProviderSessionStatus; error?: string }>;
	startedAt: string;
}

class ProviderRuntimeManager {
	private sessions = new Map<string, ProviderSession>();

	private sessionKey(missionId: string, providerId: string): string {
		return `${missionId}:${providerId}`;
	}

	async dispatch(options: DispatchOptions): Promise<DispatchResult> {
		const { executionPack, apiKeys, workingDirectory, onEvent } = options;
		const missionId = extractMissionId(executionPack);
		const startedAt = new Date().toISOString();
		const sessionStatuses: DispatchResult['sessions'] = {};

		onEvent({
			type: 'dispatch_started',
			missionId,
			source: 'spawner-ui',
			timestamp: startedAt,
			message: `Dispatching to ${executionPack.providers.length} provider(s)`,
			data: {
				strategy: executionPack.strategy,
				providers: executionPack.providers.map((p) => p.id)
			}
		});

		const providerPromises: Promise<void>[] = [];

		for (const provider of executionPack.providers) {
			const key = this.sessionKey(missionId, provider.id);
			const abortController = new AbortController();

			const session: ProviderSession = {
				providerId: provider.id,
				missionId,
				status: 'idle',
				abortController,
				startedAt: new Date(),
				completedAt: null,
				result: null,
				error: null
			};

			this.sessions.set(key, session);

			// Resolve API key: request body -> env var fallback
			const apiKey = resolveApiKey(provider, apiKeys);
			const providerPrompt = executionPack.providerPrompts[provider.id] || '';

			if (!providerPrompt) {
				session.status = 'failed';
				session.error = 'No provider prompt generated';
				sessionStatuses[provider.id] = { status: 'failed', error: session.error };
				onEvent(
					createBridgeEvent('log', { provider, missionId, onEvent, signal: abortController.signal }, {
						message: `Skipping ${provider.label}: no prompt generated`
					})
				);
				continue;
			}

			if (provider.requiresApiKey && !apiKey) {
				session.status = 'failed';
				session.error = `No API key for ${provider.label} (set ${provider.apiKeyEnv} in .env or provide in UI)`;
				sessionStatuses[provider.id] = { status: 'failed', error: session.error };
				onEvent(
					createBridgeEvent('log', { provider, missionId, onEvent, signal: abortController.signal }, {
						message: `Skipping ${provider.label}: no API key configured`
					})
				);
				continue;
			}

			session.status = 'running';
			sessionStatuses[provider.id] = { status: 'running' };

			const promise = this.executeProvider(
				provider,
				providerPrompt,
				apiKey || '',
				missionId,
				abortController,
				workingDirectory,
				onEvent
			).then((result) => {
				session.result = result;
				session.status = result.success ? 'completed' : 'failed';
				session.error = result.error || null;
				session.completedAt = new Date();
				sessionStatuses[provider.id] = {
					status: session.status,
					error: session.error || undefined
				};
			});

			providerPromises.push(promise);
		}

		// Run all providers in parallel - don't await here for immediate return
		// But we need to handle completion
		Promise.allSettled(providerPromises).then(() => {
			const allSessions = this.getSessionsForMission(missionId);
			const allComplete = allSessions.every(
				(s) => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled'
			);
			const anyFailed = allSessions.some((s) => s.status === 'failed');

			if (allComplete) {
				const type = anyFailed ? 'mission_failed' : 'mission_completed';
				onEvent({
					type,
					missionId,
					source: 'spawner-ui',
					timestamp: new Date().toISOString(),
					message: anyFailed
						? `Mission completed with errors (${allSessions.filter((s) => s.status === 'failed').length} failed)`
						: `All ${allSessions.length} providers completed successfully`,
					data: {
						providers: Object.fromEntries(
							allSessions.map((s) => [
								s.providerId,
								{ status: s.status, error: s.error, durationMs: s.result?.durationMs }
							])
						)
					}
				});
			}
		});

		return {
			success: true,
			missionId,
			sessions: sessionStatuses,
			startedAt
		};
	}

	private async executeProvider(
		provider: MultiLLMProviderConfig,
		prompt: string,
		apiKey: string,
		missionId: string,
		abortController: AbortController,
		workingDirectory: string | undefined,
		onEvent: (event: BridgeEvent) => void
	): Promise<ProviderResult> {
		try {
			if (provider.kind === 'openai_compat') {
				const opts: OpenAICompatOptions = {
					provider,
					apiKey,
					missionId,
					signal: abortController.signal,
					onEvent
				};
				return await executeOpenAICompatRequest(opts, [
					{ role: 'user', content: prompt }
				]);
			}

			if (provider.kind === 'terminal_cli') {
				// All terminal CLI providers (Claude, Codex, etc.) use the same
				// child_process spawn pattern - no API keys needed locally
				const opts: TerminalCliOptions = {
					provider,
					missionId,
					signal: abortController.signal,
					onEvent,
					workingDirectory
				};
				return await executeTerminalCliRequest(opts, prompt);
			}

			// Custom or unhandled provider kind
			onEvent(
				createBridgeEvent('log', { provider, missionId, onEvent, signal: abortController.signal }, {
					message: `Provider ${provider.label} (kind: ${provider.kind}) not supported for auto-dispatch`
				})
			);
			return {
				success: false,
				error: `Provider kind "${provider.kind}" not yet supported for auto-dispatch`
			};
		} catch (err) {
			const error = err instanceof Error ? err.message : String(err);
			return { success: false, error };
		}
	}

	async cancelProvider(missionId: string, providerId: string): Promise<boolean> {
		const key = this.sessionKey(missionId, providerId);
		const session = this.sessions.get(key);
		if (!session || session.status !== 'running') return false;

		session.abortController.abort();
		session.status = 'cancelled';
		session.completedAt = new Date();
		return true;
	}

	async cancelMission(missionId: string): Promise<void> {
		for (const [key, session] of this.sessions) {
			if (session.missionId === missionId && session.status === 'running') {
				session.abortController.abort();
				session.status = 'cancelled';
				session.completedAt = new Date();
			}
		}
	}

	getSessionsForMission(missionId: string): ProviderSession[] {
		const sessions: ProviderSession[] = [];
		for (const [, session] of this.sessions) {
			if (session.missionId === missionId) {
				sessions.push(session);
			}
		}
		return sessions;
	}

	getMissionStatus(missionId: string): {
		allComplete: boolean;
		anyFailed: boolean;
		providers: Record<string, ProviderSessionStatus>;
	} {
		const sessions = this.getSessionsForMission(missionId);
		const providers: Record<string, ProviderSessionStatus> = {};
		for (const s of sessions) {
			providers[s.providerId] = s.status;
		}
		const terminal: ProviderSessionStatus[] = ['completed', 'failed', 'cancelled'];
		return {
			allComplete: sessions.length > 0 && sessions.every((s) => terminal.includes(s.status)),
			anyFailed: sessions.some((s) => s.status === 'failed'),
			providers
		};
	}

	cleanup(missionId: string): void {
		for (const [key, session] of this.sessions) {
			if (session.missionId === missionId) {
				if (session.status === 'running') {
					session.abortController.abort();
				}
				this.sessions.delete(key);
			}
		}
	}
}

function extractMissionId(pack: MultiLLMExecutionPack): string {
	// Mission ID is embedded in provider prompts (Mission ID: xxx)
	const firstPrompt = Object.values(pack.providerPrompts)[0] || '';
	const match = firstPrompt.match(/Mission ID:\s*(\S+)/);
	return match?.[1] || `dispatch-${Date.now()}`;
}

function resolveApiKey(
	provider: MultiLLMProviderConfig,
	requestKeys: Record<string, string>
): string | undefined {
	// Keys are pre-merged by the dispatch API route (server env + UI-provided).
	// The API route uses SvelteKit's $env/dynamic/private for proper .env resolution.
	if (requestKeys[provider.id]) return requestKeys[provider.id];
	return undefined;
}

// Singleton
export const providerRuntime = new ProviderRuntimeManager();
