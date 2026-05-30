import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type StartupGateStatus = 'passed' | 'blocked' | 'pending' | 'waiting' | 'missing' | 'unknown';

export interface StartupSelfImprovementDashboard {
	generatedAt: string;
	isSampleData: boolean;
	sourceLabel: string;
	readOnly: true;
	status: string;
	claimBoundary: string;
	scoreClaimAllowed: boolean;
	improvementClaimAllowed: boolean;
	publication: {
		publicReady: boolean;
		networkAbsorbable: boolean;
	};
	score: {
		metric: string;
		baseline: number | null;
		candidate: number | null;
		delta: number | null;
		candidateBeatsBaseline: boolean;
	};
	gates: Array<{
		id: string;
		label: string;
		status: StartupGateStatus;
		pass: boolean;
		blockers: string[];
	}>;
	blockers: string[];
	nextAction: string;
	actions: {
		canDispatch: false;
		canMutate: false;
		canStartRun: false;
		reason: string;
	};
	proofBundle: {
		bundleId: string;
		status: string;
		manifestPath: string;
		sha256: string;
	};
	artifacts: {
		dossierPath: string;
		artifactManifestPath: string;
	};
	warnings: string[];
}

function readJsonObject(value: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(value);
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
	} catch {
		return null;
	}
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
	if (!existsSync(filePath)) return null;
	return readJsonObject(await readFile(filePath, 'utf-8'));
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function numberValue(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function objectValue(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function humanBlocker(value: string): string {
	if (/sidecar/i.test(value)) return 'sidecar review';
	if (/repeated/i.test(value)) return 'repeated stability';
	if (/wall.?clock|stability/i.test(value)) return 'wall-clock stability';
	if (/score.?reconciliation|score.?claim/i.test(value)) return 'score reconciliation';
	if (/wrapper/i.test(value)) return 'wrapper/raw reconciliation';
	if (/hidden|heldout/i.test(value)) return 'held-out proof';
	if (/keep|revert/i.test(value)) return 'keep/revert decision';
	return value.replace(/[_-]+/g, ' ');
}

function gateStatus(gate: Record<string, unknown>): StartupGateStatus {
	const status = String(gate.status || '').toLowerCase();
	if (gate.pass === true || ['passed', 'pass', 'ready', 'clean'].includes(status)) return 'passed';
	if (['blocked', 'failed', 'fail', 'single_seed_only'].includes(status)) return 'blocked';
	if (['pending', 'review_pending'].includes(status)) return 'pending';
	if (['waiting', 'queued', 'ledger_not_configured'].includes(status)) return 'waiting';
	if (!status) return 'missing';
	return 'unknown';
}

function gateFrom(id: string, label: string, gate: Record<string, unknown>): StartupSelfImprovementDashboard['gates'][number] {
	const blockers = unique(stringArray(gate.blockers).map(humanBlocker));
	const status = gateStatus(gate);
	return {
		id,
		label,
		status,
		pass: status === 'passed',
		blockers
	};
}

function resolveSparkQaRepoRoot(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string | null {
	const candidates = unique([
		env.SPARK_QA_OPERATOR_REPO || '',
		env.SPARK_SWARM_SPECIALIZATION_PATH_SPARK_QA_OPERATOR_REPO || '',
		path.resolve(cwd, '..', 'specialization-path-spark-qa-operator'),
		path.join(os.homedir(), 'Desktop', 'specialization-path-spark-qa-operator')
	]);
	for (const candidate of candidates) {
		if (
			existsSync(path.join(candidate, 'specialization-path.json')) &&
			existsSync(path.join(candidate, 'src', 'specialization_path_spark_qa_operator'))
		) {
			return path.resolve(candidate);
		}
	}
	return null;
}

async function latestBoundDossierPath(repoRoot: string): Promise<string | null> {
	const runsRoot = path.join(repoRoot, '.spark-swarm', 'autoloop', 'runs');
	if (!existsSync(runsRoot)) return null;
	const candidates: Array<{ filePath: string; mtimeMs: number }> = [];
	for (const entry of await readdir(runsRoot, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const filePath = path.join(runsRoot, entry.name, 'startup_bench_proof_report.bound.json');
		if (!existsSync(filePath)) continue;
		const info = await stat(filePath);
		candidates.push({ filePath, mtimeMs: info.mtimeMs });
	}
	candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return candidates[0]?.filePath || null;
}

export function normalizeStartupSelfImprovementDashboard(
	dossier: Record<string, unknown> | null,
	dossierPath = ''
): StartupSelfImprovementDashboard {
	const now = new Date().toISOString();
	if (!dossier) {
		return {
			generatedAt: now,
			isSampleData: true,
			sourceLabel: 'No bound Startup Bench dossier',
			readOnly: true,
			status: 'missing_dossier',
			claimBoundary: 'No bound Startup Bench promotion dossier is available, so Spawner cannot show or claim improvement.',
			scoreClaimAllowed: false,
			improvementClaimAllowed: false,
			publication: {
				publicReady: false,
				networkAbsorbable: false
			},
			score: { metric: 'scenario_score', baseline: null, candidate: null, delta: null, candidateBeatsBaseline: false },
			gates: [],
			blockers: ['bound Startup Bench promotion dossier missing'],
			nextAction: 'Refresh the Spark QA proof bundle before reading startup status.',
			actions: {
				canDispatch: false,
				canMutate: false,
				canStartRun: false,
				reason: 'This surface is read-only and cannot start a candidate loop.'
			},
			proofBundle: { bundleId: '', status: 'missing', manifestPath: '', sha256: '' },
			artifacts: { dossierPath, artifactManifestPath: '' },
			warnings: ['No bound dossier was found.']
		};
	}

	const privateScoreSummary = objectValue(dossier.privateScoreSummary);
	const baseline = objectValue(privateScoreSummary.baseline);
	const candidate = objectValue(privateScoreSummary.candidate);
	const comparison = objectValue(privateScoreSummary.comparison);
	const promotion = objectValue(dossier.promotionDossier);
	const proofBundle = objectValue(dossier.proofGateBundle);
	const proofGates = objectValue(dossier.proofGates);
	const repeatedStability = objectValue(dossier.repeatedStability);
	const wallClockStability = objectValue(dossier.wallClockStability);
	const scoreClaimAllowed = promotion.scoreClaimAllowed === true || dossier.scoreClaimAllowed === true;
	const improvementClaimAllowed = promotion.improvementClaimAllowed === true || dossier.improvementClaimAllowed === true;
	const publicReady = promotion.public_ready === true || dossier.public_ready === true;
	const networkAbsorbable = promotion.network_absorbable === true || dossier.network_absorbable === true;
	const blockers = unique(stringArray(promotion.blockers).map(humanBlocker));
	const nextGate = typeof promotion.nextGate === 'string' ? humanBlocker(promotion.nextGate) : '';
	const status = String(dossier.status || promotion.status || 'runner_proof_ready');
	const artifactManifestPath = objectValue(dossier.paths).artifactManifest;

	return {
		generatedAt: typeof dossier.generatedAt === 'string' ? dossier.generatedAt : now,
		isSampleData: false,
		sourceLabel: 'Bound Startup Bench promotion dossier',
		readOnly: true,
		status,
		claimBoundary: improvementClaimAllowed
			? 'The bound dossier allows the improvement claim for this candidate hash.'
			: 'Private movement is visible, but scoreClaimAllowed=false and improvementClaimAllowed=false.',
		scoreClaimAllowed,
		improvementClaimAllowed,
		publication: {
			publicReady,
			networkAbsorbable
		},
		score: {
			metric: typeof comparison.metric === 'string' ? comparison.metric : 'scenario_score',
			baseline: numberValue(baseline.scenarioScore),
			candidate: numberValue(candidate.scenarioScore),
			delta: numberValue(comparison.candidateMinusBaseline),
			candidateBeatsBaseline: comparison.candidateBeatsBaseline === true
		},
		gates: [
			gateFrom('hidden-heldout', 'Hidden heldout', objectValue(proofGates.hiddenHeldout)),
			gateFrom('wrapper-raw', 'Wrapper/raw', objectValue(proofGates.wrapperRaw)),
			gateFrom('sidecar-review', 'Sidecar review', objectValue(proofGates.sidecarReview)),
			gateFrom('repeated-stability', 'Repeated stability', repeatedStability),
			gateFrom('wall-clock-stability', 'Wall-clock stability', wallClockStability),
			gateFrom('score-reconciliation', 'Score reconciliation', objectValue(proofGates.scoreReconciliation))
		],
		blockers,
		nextAction: improvementClaimAllowed
			? 'Prepare the keep/revert decision and lesson packet.'
			: blockers[0] || nextGate || 'Complete the remaining proof gates.',
		actions: {
			canDispatch: false,
			canMutate: false,
			canStartRun: false,
			reason: 'Read-only dossier surface; use explicit approved controls elsewhere for execution.'
		},
		proofBundle: {
			bundleId: String(proofBundle.bundleId || ''),
			status: String(proofBundle.status || ''),
			manifestPath: String(proofBundle.manifestPath || ''),
			sha256: String(proofBundle.gateBundleSha256 || '')
		},
		artifacts: {
			dossierPath,
			artifactManifestPath: typeof artifactManifestPath === 'string' ? artifactManifestPath : ''
		},
		warnings: improvementClaimAllowed ? [] : ['Improvement claim is blocked until the bound dossier allows it.']
	};
}

export async function loadStartupSelfImprovementDashboard(): Promise<StartupSelfImprovementDashboard> {
	const repoRoot = resolveSparkQaRepoRoot();
	if (!repoRoot) return normalizeStartupSelfImprovementDashboard(null);
	const dossierPath = await latestBoundDossierPath(repoRoot);
	if (!dossierPath) return normalizeStartupSelfImprovementDashboard(null);
	const dossier = await readJsonFile(dossierPath);
	return normalizeStartupSelfImprovementDashboard(dossier, dossierPath);
}
