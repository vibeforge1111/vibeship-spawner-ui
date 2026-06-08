import { z } from 'zod';

export const WATCHDOG_BOARD_STATUSES = [
	'healthy',
	'degraded',
	'blocked',
	'stale',
	'empty',
	'error'
] as const;

export const WATCHDOG_ROW_STATUSES = [
	...WATCHDOG_BOARD_STATUSES,
	'approved',
	'denied',
	'missing',
	'interrupted',
	'machine-policy-origin'
] as const;

export const WATCHDOG_EVIDENCE_REDACTIONS = [
	'metadata_only',
	'redacted_ref',
	'not_available'
] as const;

export type WatchdogBoardStatus = (typeof WATCHDOG_BOARD_STATUSES)[number];
export type WatchdogRowStatus = (typeof WATCHDOG_ROW_STATUSES)[number];
export type WatchdogEvidenceRedaction = (typeof WATCHDOG_EVIDENCE_REDACTIONS)[number];

export interface WatchdogEvidenceRef {
	id: string;
	source: string;
	label: string;
	kind: string;
	redaction: WatchdogEvidenceRedaction;
	checkedAt?: string;
}

export interface WatchdogProbeRow {
	id: string;
	label: string;
	status: WatchdogRowStatus;
	severity: WatchdogBoardStatus;
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef?: string | null;
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	details?: string[];
}

export interface WatchdogAuthorityGateRow extends WatchdogProbeRow {
	gate: 'governor' | 'capability' | 'owner' | 'freshness' | 'risk' | 'machine_policy';
}

export interface WatchdogTelegramProofRow extends WatchdogProbeRow {
	relayProfile?: string | null;
	relayPort?: number | null;
	eventSource?: string | null;
}

export interface WatchdogRegistryDriftRow extends WatchdogProbeRow {
	expectedSource: string | null;
	observedSource: string | null;
	recommendedRollbackNote?: string | null;
}

export interface WatchdogRollbackNote {
	id: string;
	status: WatchdogBoardStatus;
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef?: string | null;
	recommendedAction: string;
}

export interface WatchdogOpenBlocker {
	id: string;
	status: Extract<WatchdogBoardStatus, 'blocked' | 'degraded' | 'stale' | 'error' | 'empty'>;
	source: string;
	checkedAt: string;
	summary: string;
	evidenceRef?: string | null;
	requestId?: string | null;
	missionId?: string | null;
	traceRef?: string | null;
	details?: string[];
	rollbackNoteId?: string | null;
}

export interface WatchdogProbeBoard {
	schemaVersion: 'spark.spawner.watchdog_probe_board.v1';
	requestId: string | null;
	missionId: string | null;
	traceRef: string | null;
	status: WatchdogBoardStatus;
	checkedAt: string;
	source: 'spawner-ui';
	runtimeHealth: WatchdogProbeRow[];
	authorityGates: WatchdogAuthorityGateRow[];
	telegramProof: WatchdogTelegramProofRow[];
	registryDrift: WatchdogRegistryDriftRow[];
	rollbackNotes: WatchdogRollbackNote[];
	openBlockers: WatchdogOpenBlocker[];
	evidenceRefs: WatchdogEvidenceRef[];
	privacy: {
		redaction: 'metadata_only';
		omits: string[];
	};
}

const evidenceRefSchema = z.object({
	id: z.string().min(1),
	source: z.string().min(1),
	label: z.string().min(1),
	kind: z.string().min(1),
	redaction: z.enum(WATCHDOG_EVIDENCE_REDACTIONS),
	checkedAt: z.string().optional()
});

const probeRowSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	status: z.enum(WATCHDOG_ROW_STATUSES),
	severity: z.enum(WATCHDOG_BOARD_STATUSES),
	source: z.string().min(1),
	checkedAt: z.string().min(1),
	summary: z.string().min(1),
	evidenceRef: z.string().nullable().optional(),
	requestId: z.string().nullable().optional(),
	missionId: z.string().nullable().optional(),
	traceRef: z.string().nullable().optional(),
	details: z.array(z.string()).optional()
});

const authorityGateRowSchema = probeRowSchema.extend({
	gate: z.enum(['governor', 'capability', 'owner', 'freshness', 'risk', 'machine_policy'])
});

const telegramProofRowSchema = probeRowSchema.extend({
	relayProfile: z.string().nullable().optional(),
	relayPort: z.number().int().positive().nullable().optional(),
	eventSource: z.string().nullable().optional()
});

const registryDriftRowSchema = probeRowSchema.extend({
	expectedSource: z.string().nullable(),
	observedSource: z.string().nullable(),
	recommendedRollbackNote: z.string().nullable().optional()
});

const rollbackNoteSchema = z.object({
	id: z.string().min(1),
	status: z.enum(WATCHDOG_BOARD_STATUSES),
	source: z.string().min(1),
	checkedAt: z.string().min(1),
	summary: z.string().min(1),
	evidenceRef: z.string().nullable().optional(),
	recommendedAction: z.string().min(1)
});

const openBlockerSchema = z.object({
	id: z.string().min(1),
	status: z.enum(['blocked', 'degraded', 'stale', 'error', 'empty']),
	source: z.string().min(1),
	checkedAt: z.string().min(1),
	summary: z.string().min(1),
	evidenceRef: z.string().nullable().optional(),
	requestId: z.string().nullable().optional(),
	missionId: z.string().nullable().optional(),
	traceRef: z.string().nullable().optional(),
	details: z.array(z.string()).optional(),
	rollbackNoteId: z.string().nullable().optional()
});

export const watchdogProbeBoardSchema = z.object({
	schemaVersion: z.literal('spark.spawner.watchdog_probe_board.v1'),
	requestId: z.string().nullable(),
	missionId: z.string().nullable(),
	traceRef: z.string().nullable(),
	status: z.enum(WATCHDOG_BOARD_STATUSES),
	checkedAt: z.string().min(1),
	source: z.literal('spawner-ui'),
	runtimeHealth: z.array(probeRowSchema),
	authorityGates: z.array(authorityGateRowSchema),
	telegramProof: z.array(telegramProofRowSchema),
	registryDrift: z.array(registryDriftRowSchema),
	rollbackNotes: z.array(rollbackNoteSchema),
	openBlockers: z.array(openBlockerSchema),
	evidenceRefs: z.array(evidenceRefSchema),
	privacy: z.object({
		redaction: z.literal('metadata_only'),
		omits: z.array(z.string())
	})
});

export type WatchdogProbeBoardInput = Omit<WatchdogProbeBoard, 'schemaVersion' | 'source' | 'privacy'> &
	Partial<Pick<WatchdogProbeBoard, 'schemaVersion' | 'source' | 'privacy'>>;

export const WATCHDOG_PRIVACY_OMITS = [
	'raw prompts',
	'secrets',
	'chat IDs',
	'user IDs',
	'private account identifiers',
	'provider output bodies',
	'raw request bodies'
];

const PRIVATE_KEY_PATTERN =
	/(?:chatId|chat_id|userId|user_id|accountId|account_id|rawPrompt|raw_prompt|executionPrompt|providerOutput|provider_output|responseBody|secret|token|apiKey|password)/i;
const SECRET_VALUE_PATTERN = /\b(?:sk-[A-Za-z0-9_-]{12,}|\d{5,}:[A-Za-z0-9_-]{20,})\b/;

export function deriveWatchdogStatus(input: {
	rows?: Array<Pick<WatchdogProbeRow, 'severity'>>;
	blockers?: Array<Pick<WatchdogOpenBlocker, 'status'>>;
}): WatchdogBoardStatus {
	const blockerStatuses = input.blockers?.map((blocker) => blocker.status) ?? [];
	const severities = input.rows?.map((row) => row.severity) ?? [];
	const all = [...blockerStatuses, ...severities];
	if (all.includes('blocked') || all.includes('error')) return 'blocked';
	if (all.includes('stale')) return 'stale';
	if (all.includes('degraded')) return 'degraded';
	if (all.includes('empty')) return 'empty';
	return 'healthy';
}

export function createWatchdogProbeBoard(input: WatchdogProbeBoardInput): WatchdogProbeBoard {
	const rows = [
		...input.runtimeHealth,
		...input.authorityGates,
		...input.telegramProof,
		...input.registryDrift
	];
	const board: WatchdogProbeBoard = {
		...input,
		schemaVersion: 'spark.spawner.watchdog_probe_board.v1',
		source: 'spawner-ui',
		status: deriveWatchdogStatus({ rows, blockers: input.openBlockers }),
		privacy: input.privacy ?? {
			redaction: 'metadata_only',
			omits: WATCHDOG_PRIVACY_OMITS
		}
	};
	return watchdogProbeBoardSchema.parse(board);
}

export function collectWatchdogPrivacyFindings(value: unknown): string[] {
	const findings: string[] = [];

	function visit(current: unknown, path: string): void {
		if (Array.isArray(current)) {
			current.forEach((item, index) => visit(item, `${path}[${index}]`));
			return;
		}
		if (current && typeof current === 'object') {
			for (const [key, nested] of Object.entries(current)) {
				const nextPath = path ? `${path}.${key}` : key;
				if (PRIVATE_KEY_PATTERN.test(key)) {
					findings.push(`sensitive key ${nextPath}`);
				}
				visit(nested, nextPath);
			}
			return;
		}
		if (typeof current === 'string' && SECRET_VALUE_PATTERN.test(current)) {
			findings.push(`sensitive value ${path}`);
		}
	}

	visit(value, '');
	return findings;
}

export function assertWatchdogPayloadRedacted(value: unknown): void {
	const findings = collectWatchdogPrivacyFindings(value);
	if (findings.length > 0) {
		throw new Error(`Watchdog payload contains private fields: ${findings.join(', ')}`);
	}
}

const fixtureCheckedAt = '2026-06-07T21:30:00.000Z';
const fixtureRequestId = 'tg-build-02c441099b20-1780867252235';
const fixtureMissionId = 'mission-1780867252235';
const fixtureTraceRef = 'trace:spawner-prd:mission-1780867252235';

function baseEvidence(id: string, source: string, label: string): WatchdogEvidenceRef {
	return {
		id,
		source,
		label,
		kind: 'state_ref',
		redaction: 'metadata_only',
		checkedAt: fixtureCheckedAt
	};
}

function baseRow(
	id: string,
	label: string,
	status: WatchdogRowStatus,
	severity: WatchdogBoardStatus,
	source: string,
	summary: string,
	evidenceRef: string
): WatchdogProbeRow {
	return {
		id,
		label,
		status,
		severity,
		source,
		checkedAt: fixtureCheckedAt,
		summary,
		evidenceRef,
		requestId: fixtureRequestId,
		missionId: fixtureMissionId,
		traceRef: fixtureTraceRef
	};
}

export const watchdogProbeBoardFixtures = {
	healthy: createWatchdogProbeBoard({
		requestId: fixtureRequestId,
		missionId: fixtureMissionId,
		traceRef: fixtureTraceRef,
		status: 'healthy',
		checkedAt: fixtureCheckedAt,
		runtimeHealth: [
			baseRow('runtime.prd_result', 'PRD result', 'healthy', 'healthy', 'prd-bridge', 'Canonical PRD result is present.', 'prd-result'),
			baseRow('runtime.provider', 'Provider runtime', 'healthy', 'healthy', 'provider-runtime', 'Provider session is running with redacted output.', 'provider-runtime')
		],
		authorityGates: [
			{
				...baseRow('authority.governor', 'Governor', 'approved', 'healthy', 'harness-governor', 'Native GovernorDecisionV1 evidence is present.', 'governor'),
				gate: 'governor'
			}
		],
		telegramProof: [
			{
				...baseRow('telegram.relay', 'Telegram relay', 'healthy', 'healthy', 'telegram-relay', 'Relay profile and port are present.', 'telegram-relay'),
				relayProfile: 'spark-recursive',
				relayPort: 8791,
				eventSource: 'codex'
			}
		],
		registryDrift: [
			{
				...baseRow('registry.boundary', 'Registry boundary', 'healthy', 'healthy', 'spark.toml', 'Spawner registry ownership boundary is documented.', 'spark-toml'),
				expectedSource: 'Spark CLI registry',
				observedSource: 'Spawner module metadata'
			}
		],
		rollbackNotes: [],
		openBlockers: [],
		evidenceRefs: [
			baseEvidence('prd-result', 'prd-bridge', 'results/<requestId>.json'),
			baseEvidence('provider-runtime', 'provider-runtime', 'mission-provider-results.json'),
			baseEvidence('governor', 'harness-governor', 'metadata-only Governor decision'),
			baseEvidence('telegram-relay', 'telegram-relay', 'relay metadata'),
			baseEvidence('spark-toml', 'spawner-ui', 'spark.toml')
		]
	}),
	degraded: createWatchdogProbeBoard({
		requestId: fixtureRequestId,
		missionId: fixtureMissionId,
		traceRef: fixtureTraceRef,
		status: 'degraded',
		checkedAt: fixtureCheckedAt,
		runtimeHealth: [
			baseRow('runtime.canvas', 'Canvas load', 'degraded', 'degraded', 'prd-bridge', 'Canvas load is present but older than the current check window.', 'last-canvas-load')
		],
		authorityGates: [
			{
				...baseRow('authority.risk', 'Risk gate', 'degraded', 'degraded', 'harness-governor', 'Risk evidence is present but confirmation metadata is incomplete.', 'risk-gate'),
				gate: 'risk'
			}
		],
		telegramProof: [
			{
				...baseRow('telegram.event_source', 'Last event source', 'degraded', 'degraded', 'mission-control', 'Mission Control has no recent relay source.', 'mission-control'),
				relayProfile: 'spark-recursive',
				relayPort: 8791,
				eventSource: null
			}
		],
		registryDrift: [
			{
				...baseRow('registry.unknown', 'Registry drift', 'degraded', 'degraded', 'spark-cli-registry', 'Registry evidence is not available in Spawner.', 'registry-unknown'),
				expectedSource: 'Spark CLI registry',
				observedSource: null,
				recommendedRollbackNote: 'Record CLI registry evidence before claiming release health.'
			}
		],
		rollbackNotes: [
			{
				id: 'rollback.registry-evidence',
				status: 'degraded',
				source: 'spark-cli-registry',
				checkedAt: fixtureCheckedAt,
				summary: 'Registry evidence is unknown.',
				evidenceRef: 'registry-unknown',
				recommendedAction: 'Use CLI-owned rollback instructions; do not mutate pins from Spawner.'
			}
		],
		openBlockers: [
			{
				id: 'blocker.registry-evidence',
				status: 'degraded',
				source: 'spark-cli-registry',
				checkedAt: fixtureCheckedAt,
				summary: 'Registry evidence is missing from the local Spawner evidence set.',
				evidenceRef: 'registry-unknown',
				requestId: fixtureRequestId,
				missionId: fixtureMissionId,
				traceRef: fixtureTraceRef,
				rollbackNoteId: 'rollback.registry-evidence'
			}
		],
		evidenceRefs: [
			baseEvidence('last-canvas-load', 'prd-bridge', 'last-canvas-load.json'),
			baseEvidence('risk-gate', 'harness-governor', 'risk metadata'),
			baseEvidence('mission-control', 'mission-control', 'mission-control recent event metadata'),
			baseEvidence('registry-unknown', 'spark-cli-registry', 'missing evidence marker')
		]
	}),
	blocked: createWatchdogProbeBoard({
		requestId: fixtureRequestId,
		missionId: fixtureMissionId,
		traceRef: fixtureTraceRef,
		status: 'blocked',
		checkedAt: fixtureCheckedAt,
		runtimeHealth: [
			baseRow('runtime.dispatch', 'Dispatch status', 'blocked', 'blocked', 'dispatch', 'Dispatch is blocked until authority evidence is valid.', 'dispatch-status')
		],
		authorityGates: [
			{
				...baseRow('authority.governor_missing', 'Governor', 'missing', 'blocked', 'harness-governor', 'Native GovernorDecisionV1 evidence is absent.', 'governor-missing'),
				gate: 'governor'
			}
		],
		telegramProof: [
			{
				...baseRow('telegram.correlation', 'Telegram correlation', 'blocked', 'blocked', 'telegram-relay', 'Pending request and Canvas mission metadata disagree.', 'telegram-correlation'),
				relayProfile: 'spark-recursive',
				relayPort: 8791,
				eventSource: 'prd-bridge'
			}
		],
		registryDrift: [
			{
				...baseRow('registry.blocked_unknown', 'Registry drift', 'blocked', 'blocked', 'spark-cli-registry', 'Registry source is unknown, so release health cannot be claimed.', 'registry-blocked'),
				expectedSource: 'Spark CLI registry',
				observedSource: null,
				recommendedRollbackNote: 'Pause release claims until CLI registry evidence is captured.'
			}
		],
		rollbackNotes: [
			{
				id: 'rollback.registry-blocked',
				status: 'blocked',
				source: 'spark-cli-registry',
				checkedAt: fixtureCheckedAt,
				summary: 'Registry evidence is absent.',
				evidenceRef: 'registry-blocked',
				recommendedAction: 'Record CLI-owned registry state and rollback evidence outside Spawner.'
			}
		],
		openBlockers: [
			{
				id: 'blocker.governor-missing',
				status: 'blocked',
				source: 'harness-governor',
				checkedAt: fixtureCheckedAt,
				summary: 'High-agency execution cannot claim success without native Governor evidence.',
				evidenceRef: 'governor-missing',
				requestId: fixtureRequestId,
				missionId: fixtureMissionId,
				traceRef: fixtureTraceRef,
				details: ['Route wording, bare mission IDs, pending state, and local regex are evidence only.']
			}
		],
		evidenceRefs: [
			baseEvidence('dispatch-status', 'dispatch', 'dispatch status metadata'),
			baseEvidence('governor-missing', 'harness-governor', 'missing evidence marker'),
			baseEvidence('telegram-correlation', 'telegram-relay', 'correlation metadata'),
			baseEvidence('registry-blocked', 'spark-cli-registry', 'missing evidence marker')
		]
	})
} satisfies Record<string, WatchdogProbeBoard>;
