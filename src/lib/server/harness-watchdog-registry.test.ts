import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectHarnessWatchdogRegistry } from './harness-watchdog-registry';

const checkedAt = '2026-06-07T22:15:00.000Z';
const requestId = 'tg-build-02c441099b20-1780867252235';
const missionId = 'mission-1780867252235';
const traceRef = 'trace:spawner-prd:mission-1780867252235';

let sourceRoot: string;
let sparkHome: string;

async function writeJson(filePath: string, value: unknown) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

async function writeText(filePath: string, value: string) {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, value, 'utf-8');
}

async function writeSparkToml(version = '0.0.1') {
	await writeText(
		path.join(sourceRoot, 'spark.toml'),
		`[module]\nname = "spawner-ui"\nversion = "${version}"\nkind = "app"\n`
	);
}

async function collect() {
	return collectHarnessWatchdogRegistry({
		sourceRoot,
		sparkHome,
		checkedAt,
		requestId,
		missionId,
		traceRef
	});
}

describe('collectHarnessWatchdogRegistry', () => {
	beforeEach(async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'harness-watchdog-registry-'));
		sourceRoot = path.join(root, 'source');
		sparkHome = path.join(root, 'spark-home');
		await mkdir(sourceRoot, { recursive: true });
		await mkdir(sparkHome, { recursive: true });
		await writeSparkToml();
	});

	afterEach(async () => {
		await rm(path.dirname(sourceRoot), { recursive: true, force: true });
	});

	it('reports aligned CLI registry evidence as healthy without rollback notes', async () => {
		await writeJson(path.join(sparkHome, 'registry.json'), {
			modules: {
				'spawner-ui': {
					name: 'spawner-ui',
					version: '0.0.1',
					source: 'spark-cli-registry',
					path: 'modules/spawner-ui'
				}
			}
		});

		const snapshot = await collect();

		expect(snapshot.rows.find((row) => row.id === 'registry.spawner_module')).toMatchObject({
			status: 'healthy'
		});
		expect(snapshot.rows.find((row) => row.id === 'registry.cli_source')).toMatchObject({
			status: 'healthy',
			expectedSource: 'Spark CLI registry pin for spawner-ui',
			observedSource: 'spark-cli-registry'
		});
		expect(snapshot.rollbackNotes).toEqual([]);
		expect(snapshot.openBlockers).toEqual([]);
	});

	it('turns missing registry evidence into an open blocker instead of false healthy state', async () => {
		const snapshot = await collect();

		const cliRow = snapshot.rows.find((row) => row.id === 'registry.cli_source');
		expect(cliRow).toMatchObject({
			status: 'blocked',
			severity: 'blocked',
			observedSource: null
		});
		expect(snapshot.openBlockers.map((blocker) => blocker.id)).toContain('blocker.registry.cli_source');
		expect(snapshot.rollbackNotes[0]).toMatchObject({
			id: 'rollback.registry-evidence',
			status: 'blocked'
		});
		expect(JSON.stringify(snapshot)).not.toContain('secret');
	});

	it('reports version drift with rollback guidance and does not mutate registry files', async () => {
		const registryPath = path.join(sparkHome, 'registry.json');
		await writeJson(registryPath, {
			modules: {
				'spawner-ui': {
					name: 'spawner-ui',
					version: '0.0.0',
					source: 'spark-cli-registry'
				}
			}
		});
		await writeText(
			path.join(sourceRoot, 'docs', 'ROLLBACK.md'),
			'# Rollback\n\nRestore the previous CLI-owned registry pin from the release owner.'
		);
		const before = {
			text: await readFile(registryPath, 'utf-8'),
			mtimeMs: (await stat(registryPath)).mtimeMs
		};

		const snapshot = await collect();
		const after = {
			text: await readFile(registryPath, 'utf-8'),
			mtimeMs: (await stat(registryPath)).mtimeMs
		};

		expect(snapshot.rows.find((row) => row.id === 'registry.cli_source')).toMatchObject({
			status: 'blocked',
			observedSource: 'spark-cli-registry',
			recommendedRollbackNote: expect.stringContaining('rollback note')
		});
		expect(snapshot.rollbackNotes[0]).toMatchObject({
			evidenceRef: 'registry.rollback-1',
			recommendedAction: expect.stringContaining('Spawner must not rewrite pins')
		});
		expect(after.text).toBe(before.text);
		expect(after.mtimeMs).toBe(before.mtimeMs);
	});
});
