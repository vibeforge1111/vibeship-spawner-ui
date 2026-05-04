import { env } from '$env/dynamic/private';
import path from 'node:path';
import { hostedUiLooksHosted, type HostedUiAuthEnv } from './hosted-ui-auth';

export function workspaceStateSegment(workspaceId: string): string {
	const normalized = workspaceId
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return normalized || 'workspace';
}

export function spawnerBaseStateDir(runtimeEnv: HostedUiAuthEnv = env): string {
	return process.env.SPAWNER_STATE_DIR || runtimeEnv.SPAWNER_STATE_DIR || path.resolve(process.cwd(), '.spawner');
}

export function spawnerStateDir(runtimeEnv: HostedUiAuthEnv = env): string {
	const baseDir = spawnerBaseStateDir(runtimeEnv);
	const workspaceId = runtimeEnv.SPARK_WORKSPACE_ID?.trim();
	if (!workspaceId || !hostedUiLooksHosted(runtimeEnv)) {
		return baseDir;
	}
	return path.join(baseDir, 'workspaces', workspaceStateSegment(workspaceId));
}
