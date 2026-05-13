import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
	RAW_PROVIDER_OUTPUT_RETENTION_ENV,
	writeProviderOutputPrivateArchive
} from './provider-private-archives';

let stateDir: string | null = null;

function useTempStateDir(): string {
	stateDir = mkdtempSync(path.join(tmpdir(), 'spawner-output-archive-'));
	process.env.SPAWNER_STATE_DIR = stateDir;
	return stateDir;
}

afterEach(() => {
	delete process.env.SPAWNER_STATE_DIR;
	delete process.env[RAW_PROVIDER_OUTPUT_RETENTION_ENV];
	if (stateDir) {
		rmSync(stateDir, { recursive: true, force: true });
		stateDir = null;
	}
});

describe('provider private output archives', () => {
	it('does not retain raw provider output by default', () => {
		const dir = useTempStateDir();

		const metadata = writeProviderOutputPrivateArchive({
			missionId: 'mission-default',
			providerId: 'codex',
			response: 'SECRET_PROVIDER_RESPONSE_BODY'
		});

		expect(metadata).toBeNull();
		expect(existsSync(path.join(dir, 'provider-output-private'))).toBe(false);
		expect(existsSync(path.join(dir, 'provider-output-metadata'))).toBe(false);
	});

	it('stores opt-in raw provider output only in the private archive', () => {
		const dir = useTempStateDir();
		process.env[RAW_PROVIDER_OUTPUT_RETENTION_ENV] = '1';

		const metadata = writeProviderOutputPrivateArchive({
			missionId: 'mission-fallback',
			providerId: 'codex',
			response: 'SECRET_PROVIDER_RESPONSE_BODY'
		});

		expect(metadata).toMatchObject({
			schema_version: 'spark.spawner_provider_output_private_archive.v1',
			missionId: 'mission-fallback',
			providerId: 'codex',
			responsePresent: true,
			responseLength: 'SECRET_PROVIDER_RESPONSE_BODY'.length,
			rawOutputStored: true,
			rawOutputFile: 'mission-fallback-codex.txt'
		});

		const privateOutput = readFileSync(
			path.join(dir, 'provider-output-private', 'mission-fallback-codex.txt'),
			'utf-8'
		);
		expect(privateOutput).toBe('SECRET_PROVIDER_RESPONSE_BODY');

		const metadataJson = readFileSync(
			path.join(dir, 'provider-output-metadata', 'mission-fallback-codex.json'),
			'utf-8'
		);
		expect(metadataJson).not.toContain('SECRET_PROVIDER_RESPONSE_BODY');
		expect(metadataJson).toContain(RAW_PROVIDER_OUTPUT_RETENTION_ENV);
	});
});
