import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnerStateDir } from './spawner-state';
import { safeLoopEngineeringChipKey } from './loop-engineering-control-plane';
import { defaultLoopEngineeringChipsRoot } from './loop-engineering-registry';

export interface LoopEngineeringEvidenceLookup {
	ref: string;
	kind: string;
	label: string;
	found: boolean;
	claimBoundary?: string;
	data?: unknown;
	error?: string;
}

function stateRoot(): string {
	return path.join(spawnerStateDir(), 'loop-engineering');
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readJsonFile(filePath: string): Promise<unknown> {
	const text = await readFile(filePath, 'utf-8');
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

function safePacketFileName(value: string): string | null {
	const clean = value.trim();
	if (!clean || clean !== path.basename(clean)) return null;
	if (!/^[a-z0-9._-]+$/i.test(clean)) return null;
	return clean;
}

function safePacketSegment(value: string): string | null {
	const clean = value.trim();
	if (clean === '.' || clean === '..') return null;
	if (!clean || clean !== path.basename(clean)) return null;
	if (!/^[a-z0-9._-]+$/i.test(clean)) return null;
	return clean;
}

async function readControlPlaneState(): Promise<Record<string, unknown>> {
	try {
		return asRecord(JSON.parse(await readFile(path.join(stateRoot(), 'control-plane.json'), 'utf-8')));
	} catch {
		return {};
	}
}

function collectionLabel(collection: string): string {
	if (collection === 'benchmark_cases') return 'Benchmark case';
	if (collection === 'schedules') return 'Loop schedule';
	if (collection === 'activation_rules') return 'Activation rule';
	if (collection === 'distillations') return 'Distillation';
	return 'Control-plane record';
}

async function resolveStateCollectionRef(ref: string, collection: string, id: string, chipKey: string | null): Promise<LoopEngineeringEvidenceLookup> {
	const safeChipKey = chipKey ? safeLoopEngineeringChipKey(chipKey) : null;
	if (!safeChipKey) {
		return {
			ref,
			kind: `control-plane:${collection}`,
			label: collectionLabel(collection),
			found: false,
			error: 'chipKey is required to resolve private control-plane refs'
		};
	}
	const state = await readControlPlaneState();
	const records = Array.isArray(state[collection]) ? state[collection] as unknown[] : [];
	const record = records.find((item) => {
		const candidate = asRecord(item);
		return candidate.id === id && candidate.chipKey === safeChipKey;
	});
	return {
		ref,
		kind: `control-plane:${collection}`,
		label: collectionLabel(collection),
		found: Boolean(record),
		claimBoundary: 'Private control-plane record. Inspecting it does not run, activate, publish, or approve the chip.',
		...(record ? { data: record } : {})
	};
}

async function resolvePacketRef(ref: string, collection: string, runId: string, fileName: string, chipKey: string | null): Promise<LoopEngineeringEvidenceLookup> {
	const safeChipKey = chipKey ? safeLoopEngineeringChipKey(chipKey) : null;
	if (!safeChipKey) {
		return {
			ref,
			kind: `control-plane:${collection}`,
			label: 'Evidence packet',
			found: false,
			error: 'chipKey is required to resolve private evidence packets'
		};
	}
	const safeRunId = safePacketSegment(runId);
	const safeFile = safePacketFileName(fileName);
	if (!safeRunId || !safeFile) {
		return {
			ref,
			kind: `control-plane:${collection}`,
			label: 'Evidence packet',
			found: false,
			error: 'invalid evidence packet ref'
		};
	}
	const dir = collection === 'benchmark_runs' ? 'benchmark-runs' : 'loop-runs';
	const packetDir = path.resolve(stateRoot(), dir, safeRunId);
	const filePath = path.resolve(packetDir, safeFile);
	const relative = path.relative(packetDir, filePath);
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		return {
			ref,
			kind: `control-plane:${collection}`,
			label: 'Evidence packet',
			found: false,
			error: 'invalid evidence packet path'
		};
	}
	try {
		const data = await readJsonFile(filePath);
		const record = asRecord(data);
		if (record.chipKey !== safeChipKey) {
			return {
				ref,
				kind: `control-plane:${collection}`,
				label: safeFile,
				found: false,
				error: 'evidence packet does not belong to the requested chip'
			};
		}
		return {
			ref,
			kind: `control-plane:${collection}`,
			label: safeFile,
			found: true,
			claimBoundary: 'Private local evidence packet. This can support review, but does not activate, publish, or globally approve the chip.',
			data
		};
	} catch {
		return {
			ref,
			kind: `control-plane:${collection}`,
			label: safeFile,
			found: false,
			error: 'evidence packet not found'
		};
	}
}

async function resolveChipArtifactRef(ref: string, chipKey: string | null): Promise<LoopEngineeringEvidenceLookup> {
	if (!chipKey) {
		return {
			ref,
			kind: 'chip-artifact',
			label: 'Chip artifact',
			found: false,
			error: 'chipKey is required to resolve chip artifact refs'
		};
	}
	const safeChipKey = safeLoopEngineeringChipKey(chipKey);
	if (!safeChipKey) {
		return {
			ref,
			kind: 'chip-artifact',
			label: 'Chip artifact',
			found: false,
			error: 'valid domain-chip key required'
		};
	}
	const cleanRef = ref.replace(/^\/+/, '');
	if (cleanRef.includes('..')) {
		return {
			ref,
			kind: 'chip-artifact',
			label: 'Chip artifact',
			found: false,
			error: 'invalid chip artifact ref'
		};
	}
	const chipRoot = path.join(defaultLoopEngineeringChipsRoot(), safeChipKey);
	const filePath = path.join(chipRoot, cleanRef);
	if (!filePath.startsWith(chipRoot)) {
		return {
			ref,
			kind: 'chip-artifact',
			label: 'Chip artifact',
			found: false,
			error: 'invalid chip artifact path'
		};
	}
	try {
		const data = await readJsonFile(filePath);
		return {
			ref,
			kind: 'chip-artifact',
			label: cleanRef,
			found: true,
			claimBoundary: 'Private chip artifact. Inspecting it does not change runtime activation.',
			data
		};
	} catch {
		return {
			ref,
			kind: 'chip-artifact',
			label: cleanRef,
			found: false,
			error: 'chip artifact not found'
		};
	}
}

export async function resolveLoopEngineeringEvidenceRef(input: {
	ref: string;
	chipKey?: string | null;
}): Promise<LoopEngineeringEvidenceLookup> {
	const ref = input.ref.trim();
	if (!ref) {
		return { ref, kind: 'unknown', label: 'Evidence ref', found: false, error: 'evidence ref required' };
	}

	const parts = ref.split(':');
	if (parts[0] === 'control-plane') {
		const [, collection, id, fileName] = parts;
		if ((collection === 'benchmark_runs' || collection === 'loop_runs') && id && fileName) {
			return resolvePacketRef(ref, collection, id, fileName, input.chipKey ?? null);
		}
		if (collection && id && ['benchmark_cases', 'schedules', 'activation_rules', 'distillations'].includes(collection)) {
			return resolveStateCollectionRef(ref, collection, id, input.chipKey ?? null);
		}
		return {
			ref,
			kind: 'control-plane',
			label: 'Control-plane ref',
			found: false,
			error: 'unsupported control-plane evidence ref'
		};
	}

	if (ref.startsWith('reports/') || ref.startsWith('distilled-runtime/') || ref === 'spark-chip.json') {
		return resolveChipArtifactRef(ref, input.chipKey ?? null);
	}

	if (ref.startsWith('mission-control:') || ref.startsWith('trace:')) {
		return {
			ref,
			kind: ref.startsWith('mission-control:') ? 'mission-control' : 'trace',
			label: 'Linked operational reference',
			found: false,
			claimBoundary: 'Linked operational reference. Use the mission or trace surface for full details.',
			data: { ref }
		};
	}

	return {
		ref,
		kind: 'external-or-unknown',
		label: 'Evidence ref',
		found: false,
		claimBoundary: 'Reference recorded in the ledger, but no Spawner resolver is available for this ref yet.',
		data: { ref }
	};
}
