import { env } from '$env/dynamic/private';
import path from 'path';

export function getSpawnerStateDir(): string {
	return process.env.SPAWNER_STATE_DIR || env.SPAWNER_STATE_DIR || path.join(process.cwd(), '.spawner');
}
