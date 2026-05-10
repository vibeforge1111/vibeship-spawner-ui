/**
 * Shared Command Runner - Server-side utilities for executing commands
 *
 * Used by /api/verify and /api/scan routes.
 * Handles direct process execution, timeouts, and output truncation.
 */

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, isAbsolute, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { commandTimeoutMs } from './timeout-config';
import { externalProjectPathsAllowed, resolveContainedPath, sparkWorkspaceRoot } from './spark-run-workspace';

export const MAX_OUTPUT_LENGTH = 5000;
export const COMMAND_TIMEOUT_MS = commandTimeoutMs();

export interface CommandResult {
	exitCode: number;
	stdout: string;
	stderr: string;
	duration: number;
}

export function truncateOutput(output: string): string {
	if (output.length <= MAX_OUTPUT_LENGTH) return output;
	return output.slice(-MAX_OUTPUT_LENGTH) + '\n...(truncated)';
}

/**
 * Validate project path: must be absolute, must exist, and must stay inside the Spark workspace root by default.
 */
export function validateProjectPath(projectPath: string): { valid: boolean; error?: string } {
	if (!projectPath || typeof projectPath !== 'string') {
		return { valid: false, error: 'projectPath is required' };
	}
	if (!isAbsolute(projectPath)) {
		return { valid: false, error: 'projectPath must be absolute' };
	}
	if (!existsSync(projectPath)) {
		return { valid: false, error: `Project directory does not exist: ${projectPath}` };
	}
	if (!externalProjectPathsAllowed()) {
		try {
			resolveContainedPath(sparkWorkspaceRoot(), projectPath, 'Project path');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { valid: false, error: message };
		}
	}
	return { valid: true };
}

interface SpawnCommand {
	command: string;
	args: string[];
}

function packageManagerCliPath(executable: string): string | null {
	const npmExecPath = process.env.npm_execpath;
	if (npmExecPath && existsSync(npmExecPath)) {
		const execName = basename(npmExecPath).toLowerCase();
		const execDir = dirname(npmExecPath);
		if (executable === 'npm' && execName === 'npm-cli.js') return npmExecPath;
		if (executable === 'npx') {
			const npxCliPath = join(execDir, 'npx-cli.js');
			return existsSync(npxCliPath) ? npxCliPath : null;
		}
		if (executable === 'pnpm' && execName.includes('pnpm')) return npmExecPath;
	}

	const nodeDir = dirname(process.execPath);
	const npmBinDir = join(nodeDir, 'node_modules', 'npm', 'bin');
	const candidate = executable === 'npx' ? join(npmBinDir, 'npx-cli.js') : join(npmBinDir, 'npm-cli.js');
	if ((executable === 'npm' || executable === 'npx') && existsSync(candidate)) return candidate;
	return null;
}

export function resolveSpawnCommand(command: string, args: string[]): SpawnCommand {
	if (process.platform !== 'win32') return { command, args };

	const normalizedCommand = command.toLowerCase().replace(/\.(cmd|bat)$/i, '');
	if (normalizedCommand === 'where') return { command: 'where.exe', args };
	if (['npm', 'npx', 'pnpm'].includes(normalizedCommand)) {
		const cliPath = packageManagerCliPath(normalizedCommand);
		if (cliPath) return { command: process.execPath, args: [cliPath, ...args] };
	}
	return { command, args };
}

/**
 * Run a command in the given directory with timeout
 */
export function runCommand(
	command: string,
	args: string[],
	cwd: string,
	timeoutMs: number = COMMAND_TIMEOUT_MS
): Promise<CommandResult> {
	return new Promise((res) => {
		const start = Date.now();
		let stdout = '';
		let stderr = '';
		let resolved = false;
		const spawnCommand = resolveSpawnCommand(command, args);

		const child = spawn(spawnCommand.command, spawnCommand.args, {
			cwd,
			shell: false,
			timeout: timeoutMs,
			env: { ...process.env, FORCE_COLOR: '0', CI: 'true' },
			windowsHide: true
		});

		child.stdout?.on('data', (data: Buffer) => {
			stdout += data.toString();
		});

		child.stderr?.on('data', (data: Buffer) => {
			stderr += data.toString();
		});

		child.on('close', (code) => {
			if (!resolved) {
				resolved = true;
				res({
					exitCode: code ?? 1,
					stdout: truncateOutput(stdout),
					stderr: truncateOutput(stderr),
					duration: Date.now() - start
				});
			}
		});

		child.on('error', (err) => {
			if (!resolved) {
				resolved = true;
				res({
					exitCode: 1,
					stdout: '',
					stderr: err.message,
					duration: Date.now() - start
				});
			}
		});
	});
}

/**
 * Check if a CLI tool is available on the system
 * Uses 'where' on Windows, 'which' on Unix
 */
export async function isToolAvailable(toolName: string): Promise<boolean> {
	const isWindows = process.platform === 'win32';
	const checkCmd = isWindows ? 'where.exe' : 'which';
	const result = await runCommand(checkCmd, [toolName], process.cwd(), 10_000);
	return result.exitCode === 0;
}

/**
 * Detect the right typecheck command for the project
 */
export async function detectTypecheckCommand(projectPath: string): Promise<{ command: string; args: string[] }> {
	const pkgPath = join(projectPath, 'package.json');
	if (existsSync(pkgPath)) {
		try {
			const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
			const deps = { ...pkg.dependencies, ...pkg.devDependencies };

			// SvelteKit projects use svelte-check
			if (deps['svelte-check'] || deps['@sveltejs/kit']) {
				return { command: 'npx', args: ['svelte-check', '--tsconfig', './tsconfig.json'] };
			}

			if (deps['typescript']) {
				return { command: 'npx', args: ['tsc', '--noEmit'] };
			}
		} catch {
			// fall through
		}
	}
	return { command: 'npx', args: ['tsc', '--noEmit'] };
}

/**
 * Check if a test script exists in package.json
 */
export async function hasTestScript(projectPath: string): Promise<boolean> {
	const pkgPath = join(projectPath, 'package.json');
	if (!existsSync(pkgPath)) return false;
	try {
		const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
		return !!(pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1');
	} catch {
		return false;
	}
}

/**
 * Parse test counts from output (vitest/jest)
 */
export function parseTestCounts(output: string): { passed: number; failed: number } {
	let passed = 0;
	let failed = 0;

	const vitestMatch = output.match(/(\d+)\s+passed/i);
	if (vitestMatch) passed = parseInt(vitestMatch[1], 10);
	const vitestFailMatch = output.match(/(\d+)\s+failed/i);
	if (vitestFailMatch) failed = parseInt(vitestFailMatch[1], 10);

	const jestMatch = output.match(/Tests:\s*(?:(\d+)\s*failed,?\s*)?(\d+)\s*passed/i);
	if (jestMatch) {
		if (jestMatch[1]) failed = parseInt(jestMatch[1], 10);
		passed = parseInt(jestMatch[2], 10);
	}

	return { passed, failed };
}

/**
 * Count TypeScript errors from output
 */
export function parseErrorCount(output: string): number {
	const svelteMatch = output.match(/found\s+(\d+)\s+error/i);
	if (svelteMatch) return parseInt(svelteMatch[1], 10);

	const tscMatch = output.match(/Found\s+(\d+)\s+error/i);
	if (tscMatch) return parseInt(tscMatch[1], 10);

	const tsErrors = (output.match(/: error TS/g) || []).length;
	if (tsErrors > 0) return tsErrors;

	return 0;
}

/**
 * Ensure a resolved path is within the project directory (path traversal safety)
 */
export function isPathWithinProject(filePath: string, projectPath: string): boolean {
	try {
		resolveContainedPath(projectPath, filePath, 'File path');
		return true;
	} catch {
		return false;
	}
}
