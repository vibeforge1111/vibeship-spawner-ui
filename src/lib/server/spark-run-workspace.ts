import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';

export function resolveSparkRunProjectPath(projectPath?: string): string {
	const requested = projectPath?.trim();
	const defaultRoot =
		process.env.SPARK_WORKSPACE_ROOT?.trim() ||
		process.env.SPAWNER_WORKSPACE_ROOT?.trim() ||
		(process.env.SPARK_HOME?.trim()
			? join(process.env.SPARK_HOME.trim(), 'workspaces')
			: join(homedir(), '.spark', 'workspaces'));
	const rawPath = requested || join(defaultRoot, 'default');
	const absolutePath = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
	mkdirSync(absolutePath, { recursive: true });
	return absolutePath;
}
