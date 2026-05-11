import { env } from '$env/dynamic/private';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { hostedUiLooksHosted, type HostedUiAuthEnv } from './hosted-ui-auth';

export function isWindowsAbsolutePath(value: string): boolean {
	return /^[A-Za-z]:[\\/]/.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value);
}

export function joinMaybeWindowsPath(base: string, ...segments: string[]): string {
	if (isWindowsAbsolutePath(base)) {
		return path.win32.join(base, ...segments);
	}
	return path.join(base, ...segments);
}

export function workspaceStateSegment(workspaceId: string): string {
	const normalized = workspaceId
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return normalized || 'workspace';
}

export interface SpawnerStateRootAudit {
	schema_version: 'spark.spawner_state_root_audit.v1';
	checked_at: string;
	base_state_dir: string;
	state_dir: string;
	configured_state_dir_present: boolean;
	fallback_state_dir: string;
	fallback_used: boolean;
	hosted_workspace_scoped: boolean;
	legacy_local_state_exists: boolean;
	classification: 'canonical_configured' | 'canonical_fallback' | 'active_legacy_present';
	warnings: string[];
	redaction: string;
}

export function spawnerBaseStateDir(runtimeEnv: HostedUiAuthEnv = env, fallbackCwd = process.cwd()): string {
	return process.env.SPAWNER_STATE_DIR || runtimeEnv.SPAWNER_STATE_DIR || path.resolve(fallbackCwd, '.spawner');
}

export function spawnerStateDir(runtimeEnv: HostedUiAuthEnv = env, fallbackCwd = process.cwd()): string {
	const baseDir = spawnerBaseStateDir(runtimeEnv, fallbackCwd);
	const workspaceId = runtimeEnv.SPARK_WORKSPACE_ID?.trim();
	if (!workspaceId || !hostedUiLooksHosted(runtimeEnv)) {
		return baseDir;
	}
	return joinMaybeWindowsPath(baseDir, 'workspaces', workspaceStateSegment(workspaceId));
}

export function spawnerStateRootAudit(
	runtimeEnv: HostedUiAuthEnv = env,
	fallbackCwd = process.cwd(),
	exists = existsSync
): SpawnerStateRootAudit {
	const configuredStateDir = process.env.SPAWNER_STATE_DIR || runtimeEnv.SPAWNER_STATE_DIR || '';
	const fallbackStateDir = path.resolve(fallbackCwd, '.spawner');
	const baseStateDir = spawnerBaseStateDir(runtimeEnv, fallbackCwd);
	const stateDir = spawnerStateDir(runtimeEnv, fallbackCwd);
	const fallbackUsed = !configuredStateDir;
	const legacyLocalStateExists = exists(fallbackStateDir);
	const hostedWorkspaceScoped = path.resolve(stateDir) !== path.resolve(baseStateDir);
	const warnings: string[] = [];

	if (fallbackUsed) {
		warnings.push('SPAWNER_STATE_DIR is not configured; runtime falls back to process working directory .spawner.');
	}
	if (!fallbackUsed && legacyLocalStateExists && path.resolve(fallbackStateDir) !== path.resolve(stateDir)) {
		warnings.push('Module-local .spawner exists beside configured state root; treat it as legacy until read/write audit completes.');
	}

	const classification = fallbackUsed
		? 'canonical_fallback'
		: warnings.length
			? 'active_legacy_present'
			: 'canonical_configured';

	return {
		schema_version: 'spark.spawner_state_root_audit.v1',
		checked_at: new Date().toISOString(),
		base_state_dir: baseStateDir,
		state_dir: stateDir,
		configured_state_dir_present: Boolean(configuredStateDir),
		fallback_state_dir: fallbackStateDir,
		fallback_used: fallbackUsed,
		hosted_workspace_scoped: hostedWorkspaceScoped,
		legacy_local_state_exists: legacyLocalStateExists,
		classification,
		warnings,
		redaction: 'path metadata only; mission bodies, provider output, prompts, chat ids, and secrets omitted'
	};
}
