import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type {
	WatchdogEvidenceRef,
	WatchdogOpenBlocker,
	WatchdogRegistryDriftRow,
	WatchdogRollbackNote
} from '$lib/services/harness-watchdog';
import {
	evidenceRef,
	isRecord,
	makeOpenBlocker,
	makeWatchdogRow,
	mergeEvidenceRefs,
	resolveWatchdogCorrelation,
	stringField,
	type WatchdogCorrelation
} from './harness-watchdog-state';

export interface CollectHarnessWatchdogRegistryOptions {
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	checkedAt?: string;
	sourceRoot?: string;
	sparkHome?: string;
	registryEvidenceFiles?: string[];
	rollbackEvidenceFiles?: string[];
}

export interface HarnessWatchdogRegistrySnapshot {
	requestId: string | null;
	missionId: string | null;
	traceRef: string | null;
	checkedAt: string;
	rows: WatchdogRegistryDriftRow[];
	rollbackNotes: WatchdogRollbackNote[];
	openBlockers: WatchdogOpenBlocker[];
	evidenceRefs: WatchdogEvidenceRef[];
}

interface JsonArtifact {
	id: string;
	label: string;
	source: string;
	path: string;
	value: Record<string, unknown> | null;
	exists: boolean;
	error: string | null;
	modifiedAt: string | null;
	evidenceRef: WatchdogEvidenceRef;
}

interface TextArtifact {
	id: string;
	label: string;
	source: string;
	path: string;
	text: string | null;
	exists: boolean;
	error: string | null;
	modifiedAt: string | null;
	evidenceRef: WatchdogEvidenceRef;
}

interface ModuleMetadata {
	name: string | null;
	version: string | null;
}

const MODULE_NAME = 'spawner-ui';

function defaultRegistryEvidenceFiles(sparkHome: string): string[] {
	return [
		path.join(sparkHome, 'registry.json'),
		path.join(sparkHome, 'spark-registry.json'),
		path.join(sparkHome, 'state', 'registry.json'),
		path.join(sparkHome, 'modules', 'registry.json'),
		path.join(sparkHome, 'modules', MODULE_NAME, 'registry.json')
	];
}

function defaultRollbackEvidenceFiles(sourceRoot: string, sparkHome: string): string[] {
	return [
		path.join(sourceRoot, 'docs', 'ROLLBACK.md'),
		path.join(sourceRoot, 'docs', 'RELEASE_NOTES.md'),
		path.join(sourceRoot, 'CHANGELOG.md'),
		path.join(sparkHome, 'rollback-notes.md')
	];
}

function relativeEvidenceLabel(filePath: string, rootHint: string): string {
	const relative = path.relative(rootHint, filePath);
	if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');
	return path.basename(filePath);
}

async function readJsonArtifact(input: {
	id: string;
	label: string;
	source: string;
	filePath: string;
	checkedAt: string;
}): Promise<JsonArtifact> {
	const ref = evidenceRef({
		id: input.id,
		source: input.source,
		label: input.label,
		kind: 'registry_snapshot',
		redaction: existsSync(input.filePath) ? 'metadata_only' : 'not_available',
		checkedAt: input.checkedAt
	});
	if (!existsSync(input.filePath)) {
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			path: input.filePath,
			value: null,
			exists: false,
			error: null,
			modifiedAt: null,
			evidenceRef: ref
		};
	}
	try {
		const [raw, stats] = await Promise.all([readFile(input.filePath, 'utf-8'), stat(input.filePath)]);
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			path: input.filePath,
			value: JSON.parse(raw) as Record<string, unknown>,
			exists: true,
			error: null,
			modifiedAt: stats.mtime.toISOString(),
			evidenceRef: ref
		};
	} catch (error) {
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			path: input.filePath,
			value: null,
			exists: true,
			error: error instanceof Error ? error.message : String(error),
			modifiedAt: null,
			evidenceRef: ref
		};
	}
}

async function readTextArtifact(input: {
	id: string;
	label: string;
	source: string;
	filePath: string;
	checkedAt: string;
}): Promise<TextArtifact> {
	const ref = evidenceRef({
		id: input.id,
		source: input.source,
		label: input.label,
		kind: 'rollback_note',
		redaction: existsSync(input.filePath) ? 'metadata_only' : 'not_available',
		checkedAt: input.checkedAt
	});
	if (!existsSync(input.filePath)) {
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			path: input.filePath,
			text: null,
			exists: false,
			error: null,
			modifiedAt: null,
			evidenceRef: ref
		};
	}
	try {
		const [text, stats] = await Promise.all([readFile(input.filePath, 'utf-8'), stat(input.filePath)]);
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			path: input.filePath,
			text,
			exists: true,
			error: null,
			modifiedAt: stats.mtime.toISOString(),
			evidenceRef: ref
		};
	} catch (error) {
		return {
			id: input.id,
			label: input.label,
			source: input.source,
			path: input.filePath,
			text: null,
			exists: true,
			error: error instanceof Error ? error.message : String(error),
			modifiedAt: null,
			evidenceRef: ref
		};
	}
}

function parseSparkTomlMetadata(text: string | null): ModuleMetadata {
	if (!text) return { name: null, version: null };
	let section = '';
	const metadata: ModuleMetadata = { name: null, version: null };
	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*/, '').trim();
		if (!line) continue;
		const sectionMatch = line.match(/^\[([^\]]+)\]$/);
		if (sectionMatch) {
			section = sectionMatch[1];
			continue;
		}
		if (section !== 'module') continue;
		const valueMatch = line.match(/^(name|version)\s*=\s*"([^"]*)"/);
		if (!valueMatch) continue;
		if (valueMatch[1] === 'name') metadata.name = valueMatch[2];
		if (valueMatch[1] === 'version') metadata.version = valueMatch[2];
	}
	return metadata;
}

function registryModules(value: Record<string, unknown> | null): Record<string, unknown>[] {
	if (!value) return [];
	if (Array.isArray(value.modules)) return value.modules.filter(isRecord);
	if (isRecord(value.modules)) {
		return Object.entries(value.modules).map(([name, raw]) => ({
			...(isRecord(raw) ? raw : {}),
			name: stringField(isRecord(raw) ? raw.name : null) || name
		}));
	}
	if (stringField(value.name) === MODULE_NAME || stringField(value.id) === MODULE_NAME || stringField(value.module) === MODULE_NAME) {
		return [value];
	}
	return [];
}

function findSpawnerRegistryRecord(value: Record<string, unknown> | null): Record<string, unknown> | null {
	return (
		registryModules(value).find((record) =>
			[stringField(record.name), stringField(record.id), stringField(record.module)].includes(MODULE_NAME)
		) ?? null
	);
}

function registryRecordVersion(record: Record<string, unknown> | null): string | null {
	return stringField(record?.version) || stringField(record?.installedVersion) || stringField(record?.pin);
}

function registryRecordSource(record: Record<string, unknown> | null): string | null {
	return (
		stringField(record?.source) ||
		stringField(record?.sourceRef) ||
		stringField(record?.path) ||
		stringField(record?.installSource) ||
		registryRecordVersion(record)
	);
}

function makeRegistryRow(input: {
	id: string;
	label: string;
	status: WatchdogRegistryDriftRow['status'];
	severity?: WatchdogRegistryDriftRow['severity'];
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef: string | null;
	correlation: WatchdogCorrelation;
	expectedSource: string | null;
	observedSource: string | null;
	recommendedRollbackNote?: string | null;
	details?: string[];
}): WatchdogRegistryDriftRow {
	return {
		...makeWatchdogRow(input),
		expectedSource: input.expectedSource,
		observedSource: input.observedSource,
		...(input.recommendedRollbackNote ? { recommendedRollbackNote: input.recommendedRollbackNote } : {})
	};
}

function blockerFromRow(row: WatchdogRegistryDriftRow, rollbackNoteId?: string): WatchdogOpenBlocker | null {
	if (row.severity === 'healthy') return null;
	if (!['blocked', 'degraded', 'stale', 'error', 'empty'].includes(row.severity)) return null;
	return makeOpenBlocker({
		id: `blocker.${row.id}`,
		status: row.severity as WatchdogOpenBlocker['status'],
		source: row.source,
		checkedAt: row.checkedAt,
		summary: row.summary,
		evidenceRef: row.evidenceRef,
		correlation: {
			requestId: row.requestId ?? null,
			missionId: row.missionId ?? null,
			traceRef: row.traceRef ?? null
		},
		details: row.details,
		rollbackNoteId
	});
}

function firstAvailable<T extends { exists: boolean }>(artifacts: T[]): T | null {
	return artifacts.find((artifact) => artifact.exists) ?? null;
}

function rollbackAction(rollbackArtifact: TextArtifact | null, registryKnown: boolean): string {
	if (rollbackArtifact?.exists) {
		return 'Use the recorded rollback note from the owning registry/release surface; Spawner must not rewrite pins.';
	}
	if (registryKnown) {
		return 'Record rollback evidence from the CLI/release owner before claiming post-repair release health.';
	}
	return 'Pause release health claims until CLI registry evidence and owner-supplied rollback guidance are captured.';
}

export async function collectHarnessWatchdogRegistry(
	options: CollectHarnessWatchdogRegistryOptions = {}
): Promise<HarnessWatchdogRegistrySnapshot> {
	const checkedAt = options.checkedAt ?? new Date().toISOString();
	const sourceRoot = options.sourceRoot ?? process.cwd();
	const sparkHome = options.sparkHome ?? path.join(homedir(), '.spark');
	const correlation = resolveWatchdogCorrelation({
		requestId: options.requestId,
		missionId: options.missionId,
		traceRef: options.traceRef
	});
	const sparkToml = await readTextArtifact({
		id: 'registry.spawner-spark-toml',
		label: 'spark.toml',
		source: 'spawner-ui',
		filePath: path.join(sourceRoot, 'spark.toml'),
		checkedAt
	});
	const moduleMetadata = parseSparkTomlMetadata(sparkToml.text);
	const registryFiles = options.registryEvidenceFiles ?? defaultRegistryEvidenceFiles(sparkHome);
	const registryArtifacts = await Promise.all(
		registryFiles.map((filePath, index) =>
			readJsonArtifact({
				id: `registry.cli-${index + 1}`,
				label: relativeEvidenceLabel(filePath, sparkHome),
				source: 'spark-cli-registry',
				filePath,
				checkedAt
			})
		)
	);
	const rollbackFiles = options.rollbackEvidenceFiles ?? defaultRollbackEvidenceFiles(sourceRoot, sparkHome);
	const rollbackArtifacts = await Promise.all(
		rollbackFiles.map((filePath, index) =>
			readTextArtifact({
				id: `registry.rollback-${index + 1}`,
				label: relativeEvidenceLabel(filePath, sourceRoot),
				source: 'release-rollback',
				filePath,
				checkedAt
			})
		)
	);
	const registryArtifact = firstAvailable(registryArtifacts);
	const rollbackArtifact = firstAvailable(rollbackArtifacts);
	const registryRecord = registryArtifact ? findSpawnerRegistryRecord(registryArtifact.value) : null;
	const registryVersion = registryRecordVersion(registryRecord);
	const registrySource = registryRecordSource(registryRecord);
	const rows: WatchdogRegistryDriftRow[] = [];
	const rollbackNotes: WatchdogRollbackNote[] = [];

	rows.push(
		makeRegistryRow({
			id: 'registry.spawner_module',
			label: 'Spawner module metadata',
			status: sparkToml.exists && moduleMetadata.name === MODULE_NAME ? 'healthy' : 'degraded',
			severity: sparkToml.exists && moduleMetadata.name === MODULE_NAME ? 'healthy' : 'degraded',
			source: 'spawner-ui',
			checkedAt,
			summary: sparkToml.exists
				? 'Spawner module metadata is readable from spark.toml.'
				: 'Spawner module metadata is missing from spark.toml.',
			evidenceRef: sparkToml.evidenceRef.id,
			correlation,
			expectedSource: 'spawner-ui spark.toml',
			observedSource: moduleMetadata.name && moduleMetadata.version ? `${moduleMetadata.name}@${moduleMetadata.version}` : null
		})
	);

	const rollbackNoteId = 'rollback.registry-evidence';
	const registryKnown = Boolean(registryArtifact?.exists && registryRecord);
	const registryStatus: WatchdogRegistryDriftRow['status'] = !registryArtifact
		? 'blocked'
		: registryArtifact.error || !registryArtifact.value
			? 'error'
			: !registryRecord
				? 'blocked'
				: moduleMetadata.version && registryVersion && moduleMetadata.version !== registryVersion
					? 'blocked'
					: 'healthy';
	rows.push(
		makeRegistryRow({
			id: 'registry.cli_source',
			label: 'CLI registry source',
			status: registryStatus,
			severity: registryStatus === 'healthy' ? 'healthy' : 'blocked',
			source: 'spark-cli-registry',
			checkedAt,
			summary:
				registryStatus === 'healthy'
					? 'CLI registry evidence for spawner-ui is present and version-aligned.'
					: !registryArtifact
						? 'CLI registry evidence is missing; Spawner cannot claim registry health.'
						: registryArtifact.error || !registryArtifact.value
							? 'CLI registry evidence is unreadable.'
							: !registryRecord
								? 'CLI registry evidence does not include spawner-ui.'
								: 'CLI registry version differs from spawner-ui module metadata.',
			evidenceRef: registryArtifact?.evidenceRef.id ?? 'registry.cli-missing',
			correlation,
			expectedSource: 'Spark CLI registry pin for spawner-ui',
			observedSource: registrySource,
			recommendedRollbackNote: registryStatus === 'healthy' ? null : rollbackAction(rollbackArtifact, registryKnown),
			details: [
				`spawnerVersion: ${moduleMetadata.version ?? 'unknown'}`,
				`registryVersion: ${registryVersion ?? 'unknown'}`
			]
		})
	);

	if (registryStatus !== 'healthy' || rollbackArtifact?.exists) {
		rollbackNotes.push({
			id: rollbackNoteId,
			status: registryStatus === 'healthy' ? 'degraded' : 'blocked',
			source: 'spark-cli-registry',
			checkedAt,
			summary: rollbackArtifact?.exists
				? 'Rollback evidence is available as metadata.'
				: 'Rollback evidence is missing for unresolved registry drift.',
			evidenceRef: rollbackArtifact?.evidenceRef.id ?? registryArtifact?.evidenceRef.id ?? 'registry.cli-missing',
			recommendedAction: rollbackAction(rollbackArtifact, registryKnown)
		});
	}

	const openBlockers = rows
		.map((row) => blockerFromRow(row, registryStatus === 'healthy' ? undefined : rollbackNoteId))
		.filter((blocker): blocker is WatchdogOpenBlocker => Boolean(blocker));

	const missingRegistryEvidence = evidenceRef({
		id: 'registry.cli-missing',
		source: 'spark-cli-registry',
		label: 'missing CLI registry evidence',
		kind: 'registry_snapshot',
		redaction: registryArtifact ? 'metadata_only' : 'not_available',
		checkedAt
	});

	return {
		...correlation,
		checkedAt,
		rows,
		rollbackNotes,
		openBlockers,
		evidenceRefs: mergeEvidenceRefs(
			[sparkToml.evidenceRef, missingRegistryEvidence],
			registryArtifacts.map((artifact) => artifact.evidenceRef),
			rollbackArtifacts.map((artifact) => artifact.evidenceRef)
		)
	};
}
