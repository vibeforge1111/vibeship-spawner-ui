import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareProviderWorkingDirectory } from './openclaw-bridge';

const createdDirs: string[] = [];

describe('prepareProviderWorkingDirectory', () => {
	afterEach(() => {
		for (const dir of createdDirs.splice(0)) {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('creates a missing new-project workspace before provider spawn', () => {
		const dir = join(process.cwd(), '.spawner-test', `new-project-${Date.now()}`);
		createdDirs.push(dir);

		expect(existsSync(dir)).toBe(false);
		expect(prepareProviderWorkingDirectory(dir)).toBe(dir);
		expect(existsSync(dir)).toBe(true);
	});

	it('uses the process cwd when no workspace is provided', () => {
		expect(prepareProviderWorkingDirectory()).toBe(process.cwd());
	});
});
