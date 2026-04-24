/**
 * Provider Runtime Manager
 *
 * Singleton that manages concurrent LLM provider execution sessions.
 * Routes tasks to the correct provider client (OpenAI-compat for API providers,
 * terminal CLI for local tools like Claude and Codex).
 */

import type { BridgeEvent } from '$lib/services/event-bridge';
import {
	buildMultiLLMExecutionPack,
	createDefaultMultiLLMOptions,
	type MultiLLMExecutionPack,
	type MultiLLMProviderConfig
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
import { executeSparkHarnessRequest } from './provider-clients/spark-harness-client';
import { openclawBridge } from '$lib/services/openclaw-bridge';
import { eventBridge } from '$lib/services/event-bridge';
import { mcpClient } from '$lib/services/mcp-client';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

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

interface MissionDispatchSnapshot {
	executionPack: MultiLLMExecutionPack;
	apiKeys: Record<string, string>;
	workingDirectory?: string;
}

const ACTIVE_MISSION_PATH = path.join(process.cwd(), '.spawner', 'active-mission.json');

class ProviderRuntimeManager {
	private sessions = new Map<string, ProviderSession>();
	private openclawSessionIds = new Map<string, string>();
	private dispatchSnapshots = new Map<string, MissionDispatchSnapshot>();
	private pausedMissions = new Set<string>();
	private pausedReasons = new Map<string, string>();
	private lastStatusReason = new Map<string, string>();

	private sessionKey(missionId: string, providerId: string): string {
		return `${missionId}:${providerId}`;
	}

	private rememberStatusReason(missionId: string, reason?: string): void {
		if (!reason) return;
		this.lastStatusReason.set(missionId, reason);
	}

	private async recoverDispatchSnapshot(missionId: string): Promise<MissionDispatchSnapshot | null> {
		const existing = this.dispatchSnapshots.get(missionId);
		if (existing) return existing;

		if (existsSync(ACTIVE_MISSION_PATH)) {
			try {
				const raw = await readFile(ACTIVE_MISSION_PATH, 'utf-8');
				const state = JSON.parse(raw) as {
					missionId?: string;
					multiLLMExecution?: MultiLLMExecutionPack | null;
				};
				if (state.missionId === missionId && state.multiLLMExecution) {
					const apiKeys: Record<string, string> = {};
					for (const provider of state.multiLLMExecution.providers || []) {
						if (provider.requiresApiKey && provider.apiKeyEnv) {
							const value = process.env[provider.apiKeyEnv];
							if (value && value.trim()) {
								apiKeys[provider.id] = value.trim();
							}
						}
					}

					const snapshot: MissionDispatchSnapshot = {
						executionPack: state.multiLLMExecution,
						apiKeys,
						workingDirectory: undefined
					};
					this.dispatchSnapshots.set(missionId, snapshot);
					this.rememberStatusReason(missionId, 'Recovered dispatch snapshot from active mission state');
					return snapshot;
				}
			} catch (error) {
				console.warn('[ProviderRuntime] Failed to recover dispatch snapshot from active mission file:', error);
			}
		}

		try {
			const missionResult = await mcpClient.getMission(missionId);
			const mission = missionResult.success ? missionResult.data?.mission : null;
			if (!mission) {
				return null;
			}

			const options = createDefaultMultiLLMOptions();
			const executionPack = buildMultiLLMExecutionPack({ mission, options });
			const apiKeys: Record<string, string> = {};
			for (const provider of executionPack.providers) {
				if (provider.apiKeyEnv) {
					const value = process.env[provider.apiKeyEnv];
					if (value && value.trim()) {
						apiKeys[provider.id] = value.trim();
					}
				}
			}

			const snapshot: MissionDispatchSnapshot = {
				executionPack,
				apiKeys,
				workingDirectory: undefined
			};
			this.dispatchSnapshots.set(missionId, snapshot);
			this.rememberStatusReason(missionId, 'Rebuilt dispatch snapshot from mission record');
			return snapshot;
		} catch (error) {
			console.warn('[ProviderRuntime] Failed to rebuild dispatch snapshot from mission record:', error);
			return null;
		}
	}

	async dispatch(options: DispatchOptions): Promise<DispatchResult> {
		const { executionPack, apiKeys, workingDirectory, onEvent } = options;
		const missionId = extractMissionId(executionPack);
		const startedAt = new Date().toISOString();
		const sessionStatuses: DispatchResult['sessions'] = {};

		this.dispatchSnapshots.set(missionId, {
			executionPack,
			apiKeys: { ...apiKeys },
			workingDirectory
		});
		this.pausedMissions.delete(missionId);
		this.pausedReasons.delete(missionId);
		this.lastStatusReason.set(missionId, 'Dispatch started');

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

			const assignment = executionPack.assignments[provider.id];
			const assignedExecutionTasks =
				assignment?.mode === 'execute' ? assignment.taskIds.length : 0;
			const executesFilesystem =
				provider.executesFilesystem === true ||
				(provider.kind === 'terminal_cli' && (provider.id === 'claude' || provider.id === 'codex'));
			if (assignedExecutionTasks > 0 && !executesFilesystem) {
				session.status = 'failed';
				session.error =
					`${provider.label} is connected for chat/reasoning, but it is not configured as a filesystem executor. ` +
					`Use a terminal executor provider or add an execution bridge before auto-dispatching implementation tasks.`;
				session.completedAt = new Date();
				sessionStatuses[provider.id] = { status: 'failed', error: session.error };
				this.rememberStatusReason(missionId, session.error);
				onEvent(
					createBridgeEvent('task_failed', { provider, missionId, onEvent, signal: abortController.signal }, {
						message: session.error,
						data: {
							success: false,
							error: session.error,
							provider: provider.id,
							providerLabel: provider.label,
							assignedTaskCount: assignedExecutionTasks,
							requiresFilesystemExecutor: true
						}
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
				if (session.status === 'cancelled' || result.error === 'Cancelled') {
					session.status = 'cancelled';
					session.error = result.error || session.error;
				} else {
					session.status = result.success ? 'completed' : 'failed';
					session.error = result.error || null;
				}
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
				this.rememberStatusReason(
					missionId,
					anyFailed ? 'Mission completed with provider failures' : 'Mission completed successfully'
				);
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
				if (provider.sparkExecutionBridge) {
					return await executeSparkHarnessRequest({
						provider,
						missionId,
						prompt,
						workingDirectory,
						signal: abortController.signal,
						onEvent
					});
				}

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
				if (provider.id !== 'claude' && provider.id !== 'codex') {
					return {
						success: false,
						error: `OpenClaw runtime bridge only supports claude/codex in Step 2 (received: ${provider.id})`
					};
				}

				const sessionKey = this.sessionKey(missionId, provider.id);
				const requestedOpenclawSessionId = `${missionId}-${provider.id}-${Date.now().toString(36)}`;
				this.openclawSessionIds.set(sessionKey, requestedOpenclawSessionId);

				const workerResult = await openclawBridge.executeProviderTask({
					providerId: provider.id,
					missionId,
					prompt,
					model: provider.model,
					workingDirectory,
					commandTemplate: provider.commandTemplate,
					openclawSessionId: requestedOpenclawSessionId,
					signal: abortController.signal
				});
				this.openclawSessionIds.set(sessionKey, workerResult.openclawSessionId);
				if (workerResult.success && workerResult.response) {
					onEvent(
						createBridgeEvent('task_completed', { provider, missionId, onEvent, signal: abortController.signal }, {
							message: `${provider.label} completed (${workerResult.response.length} chars)`,
							data: {
								success: true,
								responseLength: workerResult.response.length,
								response: workerResult.response,
								provider: provider.id,
								providerLabel: provider.label
							}
						})
					);
				} else if (!workerResult.success) {
					onEvent(
						createBridgeEvent('task_failed', { provider, missionId, onEvent, signal: abortController.signal }, {
							message: `${provider.label} failed: ${workerResult.error || 'unknown error'}`,
							data: {
								success: false,
								error: workerResult.error || 'unknown error',
								provider: provider.id,
								providerLabel: provider.label
							}
						})
					);
				}
				return {
					success: workerResult.success,
					response: workerResult.response,
					error: workerResult.error,
					durationMs: workerResult.durationMs
				};
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
		const openclawSessionId = this.openclawSessionIds.get(key);
		if (openclawSessionId) {
			openclawBridge.cancelProviderTask(openclawSessionId, 'Cancelled by user');
		}
		session.status = 'cancelled';
		session.completedAt = new Date();
		return true;
	}

	async cancelMission(missionId: string, reason = 'Mission cancelled'): Promise<void> {
		for (const [key, session] of this.sessions) {
			if (session.missionId === missionId && session.status === 'running') {
				session.abortController.abort();
				const openclawSessionId = this.openclawSessionIds.get(key);
				if (openclawSessionId) {
					openclawBridge.cancelProviderTask(openclawSessionId, reason);
				}
				session.status = 'cancelled';
				session.error = reason;
				session.completedAt = new Date();
			}
		}
		this.rememberStatusReason(missionId, reason);
	}

	async pauseMission(missionId: string): Promise<{ paused: boolean; reason?: string }> {
		const running = this.getSessionsForMission(missionId).filter((s) => s.status === 'running');
		if (running.length === 0) {
			const reason = 'No active provider sessions. Mission marked as paused.';
			this.pausedMissions.add(missionId);
			this.pausedReasons.set(missionId, reason);
			this.rememberStatusReason(missionId, reason);
			return { paused: true, reason };
		}

		await this.cancelMission(missionId, 'Mission paused');
		this.pausedMissions.add(missionId);
		this.pausedReasons.set(missionId, 'Mission paused');
		this.rememberStatusReason(missionId, 'Mission paused');
		return { paused: true, reason: 'Mission paused' };
	}

	async resumeMission(missionId: string): Promise<{ resumed: boolean; reason?: string }> {
		if (!this.pausedMissions.has(missionId)) {
			const reason = 'Mission is not paused.';
			this.rememberStatusReason(missionId, reason);
			return { resumed: false, reason };
		}

		const snapshot = await this.recoverDispatchSnapshot(missionId);
		if (!snapshot) {
			const reason = 'No dispatch snapshot available to resume mission (recovery failed from active state/mission record).';
			this.pausedReasons.set(missionId, reason);
			this.rememberStatusReason(missionId, reason);
			return { resumed: false, reason };
		}

		const active = this.getSessionsForMission(missionId).some((s) => s.status === 'running');
		if (active) {
			this.pausedMissions.delete(missionId);
			this.pausedReasons.delete(missionId);
			const reason = 'Mission already has running provider sessions.';
			this.rememberStatusReason(missionId, reason);
			return { resumed: true, reason };
		}

		await this.dispatch({
			executionPack: snapshot.executionPack,
			apiKeys: { ...snapshot.apiKeys },
			workingDirectory: snapshot.workingDirectory,
			onEvent: (evt) => eventBridge.emit(evt)
		});
		this.pausedMissions.delete(missionId);
		this.pausedReasons.delete(missionId);
		this.rememberStatusReason(missionId, 'Mission resumed');
		return { resumed: true, reason: 'Mission resumed' };
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
		paused: boolean;
		pausedReason: string | null;
		lastReason: string | null;
		snapshotAvailable: boolean;
		resumeable: boolean;
		resumeBlocker: string | null;
		providers: Record<string, ProviderSessionStatus>;
	} {
		const sessions = this.getSessionsForMission(missionId);
		const providers: Record<string, ProviderSessionStatus> = {};
		for (const s of sessions) {
			providers[s.providerId] = s.status;
		}
		const terminal: ProviderSessionStatus[] = ['completed', 'failed', 'cancelled'];
		const paused = this.pausedMissions.has(missionId);
		const snapshotAvailable = this.dispatchSnapshots.has(missionId);
		const pausedReason = this.pausedReasons.get(missionId) || null;
		const resumeable = paused && snapshotAvailable;
		const resumeBlocker = paused && !snapshotAvailable
			? pausedReason || 'Missing dispatch snapshot; resume will attempt reconstruction on demand.'
			: null;

		return {
			allComplete: sessions.length > 0 && sessions.every((s) => terminal.includes(s.status)),
			anyFailed: sessions.some((s) => s.status === 'failed'),
			paused,
			pausedReason,
			lastReason: this.lastStatusReason.get(missionId) || null,
			snapshotAvailable,
			resumeable,
			resumeBlocker,
			providers
		};
	}

	cleanup(missionId: string): void {
		for (const [key, session] of this.sessions) {
			if (session.missionId === missionId) {
				if (session.status === 'running') {
					session.abortController.abort();
					const openclawSessionId = this.openclawSessionIds.get(key);
					if (openclawSessionId) {
						openclawBridge.cancelProviderTask(openclawSessionId, 'Runtime cleanup');
					}
				}
				this.openclawSessionIds.delete(key);
				this.sessions.delete(key);
			}
		}
		this.dispatchSnapshots.delete(missionId);
		this.pausedMissions.delete(missionId);
		this.pausedReasons.delete(missionId);
		this.lastStatusReason.delete(missionId);
	}
}

function extractMissionId(pack: MultiLLMExecutionPack): string {
	if (pack.missionId) return pack.missionId;
	// Legacy fallback: orchestrator prompts embed "Mission ID: xxx"
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
