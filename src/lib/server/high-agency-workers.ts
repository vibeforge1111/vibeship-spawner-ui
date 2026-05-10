import { realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { externalProjectPathsAllowed, resolveWorkspaceContainedPath, sparkWorkspaceRoot } from './spark-run-workspace';

export const HIGH_AGENCY_WORKERS_ENV = 'SPARK_ALLOW_HIGH_AGENCY_WORKERS';

export interface HighAgencyWorkerApproval {
	workingDirectory: string;
	workspaceRoot: string;
	externalProjectPathsAllowed: boolean;
}

function resolveExistingPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

export function highAgencyWorkersAllowed(envRecord: Record<string, string | undefined> = process.env): boolean {
	const value = envRecord[HIGH_AGENCY_WORKERS_ENV]?.trim().toLowerCase();
	return value === '1' || value === 'true' || value === 'yes';
}

export function assertHighAgencyWorkerAllowed(workingDirectory?: string): HighAgencyWorkerApproval {
	if (!highAgencyWorkersAllowed()) {
		throw new Error(
			`High-agency worker mode is disabled. Set ${HIGH_AGENCY_WORKERS_ENV}=1 only on trusted local installs.`
		);
	}

	const workspaceRoot = resolveExistingPath(sparkWorkspaceRoot());
	const cwd = resolve(workingDirectory?.trim() || process.cwd());
	const externalAllowed = externalProjectPathsAllowed();
	let workingDirectoryResolved = cwd;
	if (!externalAllowed) {
		try {
			workingDirectoryResolved = resolveWorkspaceContainedPath(cwd, 'High-agency worker path');
		} catch {
			throw new Error(
				`High-agency workers must run inside Spark workspace root (${workspaceRoot}). ` +
					`Use a workspace path like "${basename(cwd) || 'project'}", ` +
					'or set SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=1 for trusted local development.'
			);
		}
	}

	return {
		workingDirectory: workingDirectoryResolved,
		workspaceRoot,
		externalProjectPathsAllowed: externalAllowed
	};
}

export function resolveCodexSandbox(envRecord: Record<string, string | undefined> = process.env): string {
	const sandbox = envRecord.SPARK_CODEX_SANDBOX?.trim() || 'workspace-write';
	if (!['read-only', 'workspace-write', 'danger-full-access'].includes(sandbox)) {
		throw new Error(`Unsupported SPARK_CODEX_SANDBOX value: ${sandbox}`);
	}
	if (sandbox === 'danger-full-access' && !highAgencyWorkersAllowed(envRecord)) {
		throw new Error(`SPARK_CODEX_SANDBOX=danger-full-access requires ${HIGH_AGENCY_WORKERS_ENV}=1`);
	}
	return sandbox;
}
