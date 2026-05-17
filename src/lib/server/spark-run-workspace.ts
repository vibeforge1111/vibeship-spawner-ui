import { existsSync, mkdirSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path';

export class SparkRunWorkspaceError extends Error {
	status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'SparkRunWorkspaceError';
	}
}

export function sparkWorkspaceRoot(): string {
	return resolve(
		process.env.SPARK_WORKSPACE_ROOT?.trim() ||
			process.env.SPAWNER_WORKSPACE_ROOT?.trim() ||
			(process.env.SPARK_HOME?.trim()
			? join(process.env.SPARK_HOME.trim(), 'workspaces')
			: join(homedir(), '.spark', 'workspaces'))
	);
}

export function externalProjectPathsAllowed(): boolean {
	const value = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS?.trim().toLowerCase();
	return value === '1' || value === 'true' || value === 'yes';
}

export function isWithinDirectory(baseDir: string, targetPath: string): boolean {
	const normalizedBase = resolve(baseDir);
	const normalizedTarget = resolve(targetPath);
	const baseLower = process.platform === 'win32' ? normalizedBase.toLowerCase() : normalizedBase;
	const targetLower = process.platform === 'win32' ? normalizedTarget.toLowerCase() : normalizedTarget;
	return targetLower === baseLower || targetLower.startsWith(`${baseLower}${sep}`);
}

function resolveExistingPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return resolve(path);
	}
}

function resolveThroughExistingParent(path: string): string {
	const absolutePath = resolve(path);
	const missingSegments: string[] = [];
	let cursor = absolutePath;
	while (!existsSync(cursor)) {
		const parent = dirname(cursor);
		if (parent === cursor) return absolutePath;
		missingSegments.unshift(basename(cursor));
		cursor = parent;
	}
	return resolve(resolveExistingPath(cursor), ...missingSegments);
}

export function resolveContainedPath(baseDir: string, targetPath: string, label = 'Path'): string {
	const baseResolved = resolveThroughExistingParent(baseDir);
	const targetResolved = resolveThroughExistingParent(targetPath);
	if (!isWithinDirectory(baseResolved, targetResolved)) {
		throw new SparkRunWorkspaceError(
			`${label} must stay inside Spark workspace root (${baseResolved}). ` +
				`Use a relative workspace name like "${basename(targetResolved) || 'project'}", ` +
				'or set SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=1 for trusted local development.'
		);
	}
	return targetResolved;
}

export function resolveWorkspaceContainedPath(targetPath: string, label = 'Project path'): string {
	return resolveContainedPath(sparkWorkspaceRoot(), targetPath, label);
}

export function resolveSparkRunProjectPath(projectPath?: string): string {
	const requested = projectPath?.trim();
	const defaultRoot = sparkWorkspaceRoot();
	const rawPath = requested || join(defaultRoot, 'default');
	const absolutePath = isAbsolute(rawPath) ? resolve(rawPath) : resolve(defaultRoot, rawPath);

	const containedPath = externalProjectPathsAllowed()
		? absolutePath
		: resolveContainedPath(defaultRoot, absolutePath, 'Project path');

	mkdirSync(containedPath, { recursive: true });
	return containedPath;
}
