/**
 * Codex CLI Provider Client
 *
 * Spawns `codex exec` as a child process on Windows (no tmux dependency).
 * Captures stdout/stderr and emits progress events.
 */

import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderResult, ProviderClientOptions } from './types';
import { createBridgeEvent } from './types';

export interface CodexCliOptions extends ProviderClientOptions {
	workingDirectory?: string;
}

export async function isCliBinaryAvailable(binaryName: string): Promise<boolean> {
	try {
		execSync(`where ${binaryName}`, { stdio: 'pipe', timeout: 5000 });
		return true;
	} catch {
		return false;
	}
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
	const commandTemplate = provider.commandTemplate || `${provider.id} --model {model}`;
	const binaryName = commandTemplate.split(/\s+/)[0];

	// Check if binary exists in PATH
	const available = await isCliBinaryAvailable(binaryName);
	if (!available) {
		const error = `${provider.label} CLI "${binaryName}" not found in PATH`;
		onEvent(
			createBridgeEvent('error', options, {
				message: error,
				data: { error }
			})
		);
		return { success: false, error, durationMs: Date.now() - startTime };
	}

	// Write prompt to file for reference
	const promptsDir = join(process.cwd(), '.spawner', 'prompts');
	if (!existsSync(promptsDir)) {
		mkdirSync(promptsDir, { recursive: true });
	}
	const promptFile = join(promptsDir, `${missionId}-${provider.id}.md`);
	writeFileSync(promptFile, prompt, 'utf-8');

	return new Promise<ProviderResult>((resolve) => {
		const model = provider.model || 'gpt-5.3-codex';
		const command = commandTemplate.replace('{model}', model);

		const args = command.split(/\s+/);
		const bin = args.shift()!;

		const cwd = workingDirectory || process.cwd();

		let stdout = '';
		let stderr = '';
		let lastProgressEmit = Date.now();
		let killed = false;

		const child = spawn(bin, args, {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
			shell: true,
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
