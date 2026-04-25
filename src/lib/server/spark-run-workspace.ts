import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';

export class SparkRunWorkspaceError extends Error {
	status = 400;

	constructor(message: string) {
		super(message);
		this.name = 'SparkRunWorkspaceError';
	}
}

function sparkWorkspaceRoot(): string {
	return resolve(
		process.env.SPARK_WORKSPACE_ROOT?.trim() ||
			process.env.SPAWNER_WORKSPACE_ROOT?.trim() ||
			(process.env.SPARK_HOME?.trim()
			? join(process.env.SPARK_HOME.trim(), 'workspaces')
			: join(homedir(), '.spark', 'workspaces'))
	);
}

function externalProjectPathsAllowed(): boolean {
	const value = process.env.SPARK_ALLOW_EXTERNAL_PROJECT_PATHS?.trim().toLowerCase();
	return value === '1' || value === 'true' || value === 'yes';
}

function isWithinDirectory(baseDir: string, targetPath: string): boolean {
	const normalizedBase = resolve(baseDir);
	const normalizedTarget = resolve(targetPath);
	const baseLower = normalizedBase.toLowerCase();
	const targetLower = normalizedTarget.toLowerCase();
	return targetLower === baseLower || targetLower.startsWith(`${baseLower}${sep}`);
}

export function resolveSparkRunProjectPath(projectPath?: string): string {
	const requested = projectPath?.trim();
	const defaultRoot = sparkWorkspaceRoot();
	const rawPath = requested || join(defaultRoot, 'default');
	const absolutePath = isAbsolute(rawPath) ? resolve(rawPath) : resolve(defaultRoot, rawPath);

	if (!externalProjectPathsAllowed() && !isWithinDirectory(defaultRoot, absolutePath)) {
		throw new SparkRunWorkspaceError(
			`Project path must stay inside Spark workspace root (${defaultRoot}). ` +
				`Use a relative workspace name like "${basename(absolutePath) || 'project'}", ` +
				'or set SPARK_ALLOW_EXTERNAL_PROJECT_PATHS=1 for trusted local development.'
		);
	}

	mkdirSync(absolutePath, { recursive: true });
	return absolutePath;
}
