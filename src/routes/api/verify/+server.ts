/**
 * Server-Side Verification API — Longshot Active Verification Harness
 *
 * Runs REAL commands (build, typecheck, test) in the project directory
 * and checks REAL file existence on disk. This replaces trust-based
 * self-reporting with independent server-side verification.
 *
 * POST /api/verify
 *   body: { action, projectPath, files?, command? }
 *   actions: 'build' | 'typecheck' | 'test' | 'files' | 'scan'
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { stat } from 'node:fs/promises';
import { join, isAbsolute, resolve } from 'node:path';
import {
	validateProjectPath,
	runCommand,
	detectTypecheckCommand,
	hasTestScript,
	parseTestCounts,
	parseErrorCount,
	isPathWithinProject
} from '$lib/server/command-runner';

export interface VerifyRequest {
	action: 'build' | 'typecheck' | 'test' | 'files' | 'scan';
	projectPath: string;
	files?: string[];
	command?: string;
}

export interface VerifyBuildResult {
	action: 'build';
	success: boolean;
	exitCode: number;
	stdout: string;
	stderr: string;
	duration: number;
}

export interface VerifyTypecheckResult {
	action: 'typecheck';
	success: boolean;
	errorCount: number;
	exitCode: number;
	stdout: string;
	stderr: string;
	duration: number;
}

export interface VerifyTestResult {
	action: 'test';
	success: boolean;
	hasTestScript: boolean;
	passed: number;
	failed: number;
	exitCode: number;
	stdout: string;
	stderr: string;
	duration: number;
}

export interface VerifyFilesResult {
	action: 'files';
	found: string[];
	missing: string[];
	total: number;
	existenceRate: number;
}

export interface VerifyScanResult {
	action: 'scan';
	build: VerifyBuildResult;
	typecheck: VerifyTypecheckResult;
	test: VerifyTestResult;
	allPassed: boolean;
	duration: number;
}

export type VerifyResult = VerifyBuildResult | VerifyTypecheckResult | VerifyTestResult | VerifyFilesResult | VerifyScanResult;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json() as VerifyRequest;
		const { action, projectPath, files, command } = body;

		if (!action || !['build', 'typecheck', 'test', 'files', 'scan'].includes(action)) {
			return json({ error: 'Invalid action. Must be: build, typecheck, test, files, scan' }, { status: 400 });
		}

		const validation = validateProjectPath(projectPath);
		if (!validation.valid) {
			return json({ error: validation.error }, { status: 400 });
		}

		switch (action) {
			case 'build': {
				const buildCmd = command || 'npm';
				const buildArgs = command ? [] : ['run', 'build'];
				const result = await runCommand(buildCmd, buildArgs, projectPath);
				const response: VerifyBuildResult = {
					action: 'build',
					success: result.exitCode === 0,
					exitCode: result.exitCode,
					stdout: result.stdout,
					stderr: result.stderr,
					duration: result.duration
				};
				return json(response);
			}

			case 'typecheck': {
				const tcCmd = command
					? { command: command.split(' ')[0], args: command.split(' ').slice(1) }
					: await detectTypecheckCommand(projectPath);
				const result = await runCommand(tcCmd.command, tcCmd.args, projectPath);
				const errorCount = parseErrorCount(result.stdout + '\n' + result.stderr);
				const response: VerifyTypecheckResult = {
					action: 'typecheck',
					success: result.exitCode === 0,
					errorCount,
					exitCode: result.exitCode,
					stdout: result.stdout,
					stderr: result.stderr,
					duration: result.duration
				};
				return json(response);
			}

			case 'test': {
				const hasTests = await hasTestScript(projectPath);
				if (!hasTests) {
					const response: VerifyTestResult = {
						action: 'test',
						success: true,
						hasTestScript: false,
						passed: 0,
						failed: 0,
						exitCode: 0,
						stdout: 'No test script found in package.json',
						stderr: '',
						duration: 0
					};
					return json(response);
				}
				const result = await runCommand('npm', ['run', 'test', '--', '--run'], projectPath);
				const counts = parseTestCounts(result.stdout + '\n' + result.stderr);
				const response: VerifyTestResult = {
					action: 'test',
					success: result.exitCode === 0,
					hasTestScript: true,
					passed: counts.passed,
					failed: counts.failed,
					exitCode: result.exitCode,
					stdout: result.stdout,
					stderr: result.stderr,
					duration: result.duration
				};
				return json(response);
			}

			case 'files': {
				if (!files || !Array.isArray(files) || files.length === 0) {
					return json({ error: 'files array is required for files action' }, { status: 400 });
				}

				const found: string[] = [];
				const missing: string[] = [];

				for (const file of files) {
					const filePath = isAbsolute(file) ? file : join(projectPath, file);

					if (!isPathWithinProject(filePath, projectPath)) {
						missing.push(file);
						continue;
					}

					try {
						await stat(resolve(filePath));
						found.push(file);
					} catch {
						missing.push(file);
					}
				}

				const response: VerifyFilesResult = {
					action: 'files',
					found,
					missing,
					total: files.length,
					existenceRate: files.length > 0 ? found.length / files.length : 0
				};
				return json(response);
			}

			case 'scan': {
				const scanStart = Date.now();

				// Run build, typecheck, test in parallel
				const [buildResult, typecheckResult, testResult] = await Promise.all([
					(async (): Promise<VerifyBuildResult> => {
						const r = await runCommand('npm', ['run', 'build'], projectPath);
						return { action: 'build', success: r.exitCode === 0, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, duration: r.duration };
					})(),
					(async (): Promise<VerifyTypecheckResult> => {
						const tcCmd = await detectTypecheckCommand(projectPath);
						const r = await runCommand(tcCmd.command, tcCmd.args, projectPath);
						const errorCount = parseErrorCount(r.stdout + '\n' + r.stderr);
						return { action: 'typecheck', success: r.exitCode === 0, errorCount, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, duration: r.duration };
					})(),
					(async (): Promise<VerifyTestResult> => {
						const hasTests = await hasTestScript(projectPath);
						if (!hasTests) {
							return { action: 'test', success: true, hasTestScript: false, passed: 0, failed: 0, exitCode: 0, stdout: 'No test script found', stderr: '', duration: 0 };
						}
						const r = await runCommand('npm', ['run', 'test', '--', '--run'], projectPath);
						const counts = parseTestCounts(r.stdout + '\n' + r.stderr);
						return { action: 'test', success: r.exitCode === 0, hasTestScript: true, passed: counts.passed, failed: counts.failed, exitCode: r.exitCode, stdout: r.stdout, stderr: r.stderr, duration: r.duration };
					})()
				]);

				const response: VerifyScanResult = {
					action: 'scan',
					build: buildResult,
					typecheck: typecheckResult,
					test: testResult,
					allPassed: buildResult.success && typecheckResult.success && testResult.success,
					duration: Date.now() - scanStart
				};
				return json(response);
			}

			default:
				return json({ error: 'Unknown action' }, { status: 400 });
		}
	} catch (err) {
		return json(
			{ error: `Verification failed: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 500 }
		);
	}
};
