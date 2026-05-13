/**
 * Codex CLI Provider Client
 *
 * Spawns `codex exec` as a child process on Windows (no tmux dependency).
 * Captures stdout/stderr and emits progress events.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderResult, ProviderClientOptions } from './types';
import { createBridgeEvent } from './types';
import { resolveCliBinary } from '../cli-resolver';
import { spawnHidden } from '../hidden-process';
import {
	assertHighAgencyWorkerAllowed,
	highAgencyWorkersAllowed,
	HIGH_AGENCY_WORKERS_ENV
} from '../high-agency-workers';
import { spawnerStateDir } from '../spawner-state';
import { prepareProviderWorkingDirectory } from '$lib/services/spark-agent-bridge';

export interface CodexCliOptions extends ProviderClientOptions {
	workingDirectory?: string;
}

export interface CodexCliCommand {
	binary: 'codex' | string;
	args: string[];
}

export interface ProviderPromptReferenceMetadata {
	schema_version: 'spark.spawner_provider_prompt_reference.v1';
	missionId: string;
	providerId: string;
	promptPresent: boolean;
	promptLength: number;
	rawPromptStored: boolean;
	rawPromptPath: string | null;
	redaction: string;
	createdAt: string;
}

export interface ParseCodexCliCommandOptions {
	allowHighAgency?: boolean;
}

const RAW_PROVIDER_PROMPT_RETENTION_ENV = 'SPARK_SPAWNER_RETAIN_RAW_PROVIDER_PROMPTS';

function isSafeCommandToken(value: string): boolean {
	return /^[A-Za-z0-9._:/@+=-]+$/.test(value);
}

function safeFileSegment(value: string): string {
	return value
		.trim()
		.replace(/[^A-Za-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 120) || 'unknown';
}

export function retainRawProviderPrompts(env: Record<string, string | undefined> = process.env): boolean {
	return env[RAW_PROVIDER_PROMPT_RETENTION_ENV] === '1';
}

export function writeProviderPromptReference(
	input: {
		missionId: string;
		providerId: string;
		prompt: string;
	},
	env: Record<string, string | undefined> = process.env
): ProviderPromptReferenceMetadata {
	const fileStem = `${safeFileSegment(input.missionId)}-${safeFileSegment(input.providerId)}`;
	const stateDir = spawnerStateDir();
	const metadataDir = join(stateDir, 'prompt-metadata');
	if (!existsSync(metadataDir)) {
		mkdirSync(metadataDir, { recursive: true });
	}

	let rawPromptStored = false;
	let rawPromptPath: string | null = null;
	if (retainRawProviderPrompts(env)) {
		const rawPromptsDir = join(stateDir, 'prompts-private');
		if (!existsSync(rawPromptsDir)) {
			mkdirSync(rawPromptsDir, { recursive: true });
		}
		rawPromptPath = join(rawPromptsDir, `${fileStem}.md`);
		writeFileSync(rawPromptPath, input.prompt, 'utf-8');
		rawPromptStored = true;
	}

	const metadata: ProviderPromptReferenceMetadata = {
		schema_version: 'spark.spawner_provider_prompt_reference.v1',
		missionId: input.missionId,
		providerId: input.providerId,
		promptPresent: input.prompt.trim().length > 0,
		promptLength: input.prompt.length,
		rawPromptStored,
		rawPromptPath,
		redaction: rawPromptStored
			? `local-private opt-in raw prompt retention enabled by ${RAW_PROVIDER_PROMPT_RETENTION_ENV}`
			: 'metadata-only; raw provider prompts are not persisted by default',
		createdAt: new Date().toISOString()
	};
	writeFileSync(join(metadataDir, `${fileStem}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
	return metadata;
}

export function parseCodexCliCommand(
	commandTemplate: string,
	options: ParseCodexCliCommandOptions = {}
): CodexCliCommand {
	const tokens = commandTemplate.split(/\s+/).filter(Boolean);
	if (tokens.some((token) => !isSafeCommandToken(token))) {
		throw new Error('Codex command template contains unsafe shell characters');
	}
	if (tokens[0] !== 'codex' || tokens[1] !== 'exec') {
		throw new Error('Codex command template must start with: codex exec');
	}
	if (tokens.length === 3 && tokens[2] === '--yolo') {
		const allowHighAgency = options.allowHighAgency ?? highAgencyWorkersAllowed();
		if (!allowHighAgency) {
			throw new Error(`codex exec high-agency mode requires ${HIGH_AGENCY_WORKERS_ENV}=1`);
		}
		return { binary: 'codex', args: ['exec', '--skip-git-repo-check', '--yolo'] };
	}
	if (tokens.length === 4 && tokens[2] === '--model') {
		return { binary: 'codex', args: ['exec', '--skip-git-repo-check', '--model', tokens[3]] };
	}
	throw new Error('Codex command template must be: codex exec --model <model>');
}

export async function isCliBinaryAvailable(binaryName: 'codex'): Promise<boolean> {
	return resolveCliBinary(binaryName) !== null;
}

export async function executeCodexCliRequest(
	options: CodexCliOptions,
	prompt: string
): Promise<ProviderResult> {
	const { provider, missionId, signal, onEvent, workingDirectory } = options;
	const startTime = Date.now();

	onEvent(
		createBridgeEvent('task_started', options, {
			message: `${provider.label} starting (model: ${provider.model})`,
			data: { provider: provider.id, model: provider.model }
		})
	);

	// Detect the binary name from the command template
	const commandTemplate = provider.commandTemplate || 'codex exec --model {model}';
	const model = provider.model || 'gpt-5.5';
	let command: CodexCliCommand;
	try {
		command = parseCodexCliCommand(commandTemplate.replace('{model}', model));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		onEvent(
			createBridgeEvent('error', options, {
				message,
				data: { error: message }
			})
		);
		return { success: false, error: message, durationMs: Date.now() - startTime };
	}
	if (command.args.includes('--yolo')) {
		let approval;
		try {
			approval = assertHighAgencyWorkerAllowed(workingDirectory);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			onEvent(
				createBridgeEvent('error', options, {
					message,
					data: { error: message }
				})
			);
			return { success: false, error: message, durationMs: Date.now() - startTime };
		}
		onEvent(
			createBridgeEvent('worker_high_agency_approved', options, {
				message: `${provider.label} high-agency worker approved`,
				data: {
					provider: provider.id,
					workingDirectory: approval.workingDirectory,
					workspaceRoot: approval.workspaceRoot,
					externalProjectPathsAllowed: approval.externalProjectPathsAllowed
				}
			})
		);
	}

	const resolvedBinary = resolveCliBinary('codex');
	if (!resolvedBinary) {
		const error = `${provider.label} CLI "${command.binary}" not found in PATH`;
		onEvent(
			createBridgeEvent('error', options, {
				message: error,
				data: { error }
			})
		);
		return { success: false, error, durationMs: Date.now() - startTime };
	}

	writeProviderPromptReference({ missionId, providerId: provider.id, prompt });

	return new Promise<ProviderResult>((resolve) => {
		let cwd: string;
		try {
			cwd = prepareProviderWorkingDirectory(workingDirectory);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			resolve({ success: false, error: message, durationMs: Date.now() - startTime });
			return;
		}

		let stdout = '';
		let stderr = '';
		let lastProgressEmit = Date.now();
		let killed = false;

		const child = spawnHidden(resolvedBinary, command.args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env }
		});

		// Send prompt via stdin
		if (child.stdin) {
			child.stdin.write(prompt);
			child.stdin.end();
		}

		// Handle abort signal
		if (signal) {
			const abortHandler = () => {
				killed = true;
				try {
					child.kill('SIGTERM');
				} catch {
					// Process may have already exited
				}
			};
			signal.addEventListener('abort', abortHandler, { once: true });
		}

		child.stdout?.on('data', (data: Buffer) => {
			const chunk = data.toString();
			stdout += chunk;

			// Emit progress periodically
			const now = Date.now();
			if (now - lastProgressEmit > 3000) {
				const lines = stdout.split('\n').filter(Boolean);
				onEvent(
					createBridgeEvent('task_progress', options, {
						progress: Math.min(80, Math.floor(lines.length * 5)),
						message: `${provider.label}: processing... (${lines.length} output lines)`
					})
				);
				lastProgressEmit = now;
			}
		});

		child.stderr?.on('data', (data: Buffer) => {
			stderr += data.toString();
		});

		child.on('error', (err) => {
			onEvent(
				createBridgeEvent('error', options, {
					message: `${provider.label} process error: ${err.message}`,
					data: { error: err.message }
				})
			);
			resolve({
				success: false,
				error: `Process error: ${err.message}`,
				durationMs: Date.now() - startTime
			});
		});

		child.on('close', (code) => {
			if (killed) {
				resolve({
					success: false,
					error: 'Cancelled',
					durationMs: Date.now() - startTime
				});
				return;
			}

			const success = code === 0;
			const response = stdout.trim();

			if (success) {
				onEvent(
					createBridgeEvent('task_completed', options, {
						message: `${provider.label} completed (exit code ${code})`,
						data: { success: true, responseLength: response.length }
					})
				);
			} else {
				onEvent(
					createBridgeEvent('error', options, {
						message: `${provider.label} exited with code ${code}: ${stderr.slice(0, 500)}`,
						data: { exitCode: code, stderr: stderr.slice(0, 500) }
					})
				);
			}

			resolve({
				success,
				response,
				error: success ? undefined : `Exit code ${code}: ${stderr.slice(0, 500)}`,
				durationMs: Date.now() - startTime
			});
		});
	});
}
