import { env } from '$env/dynamic/private';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const CREATOR_TRACE_SCHEMA_VERSION = 'spark-creator-trace.v1';
export const CREATOR_INTENT_SCHEMA_VERSION = 'spark-creator-intent.v1';

export type CreatorPrivacyMode = 'local_only' | 'github_pr' | 'swarm_shared';
export type CreatorRiskLevel = 'low' | 'medium' | 'high';
export type CreatorStageStatus = 'queued' | 'running' | 'blocked' | 'validated' | 'failed' | 'published';
export type CreatorMode = 'domain_chip' | 'specialization_path' | 'benchmark' | 'autoloop' | 'full_path';

export interface CreatorIntentPacket {
	schema_version: typeof CREATOR_INTENT_SCHEMA_VERSION;
	user_goal: string;
	target_domain: string;
	target_operator_surface: string;
	expected_agent_capability: string;
	success_examples: string[];
	failure_examples: string[];
	tools_in_scope: string[];
	data_sources_allowed: string[];
	risk_level: CreatorRiskLevel;
	privacy_mode: CreatorPrivacyMode;
	desired_outputs: {
		domain_chip: boolean;
		specialization_path: boolean;
		benchmark_pack: boolean;
		autoloop_policy: boolean;
		telegram_flow: boolean;
		spawner_mission: boolean;
		swarm_publish_packet: boolean;
	};
}

export interface CreatorMissionTrace {
	schema_version: typeof CREATOR_TRACE_SCHEMA_VERSION;
	mission_id: string;
	request_id: string;
	creator_mode: CreatorMode;
	user_goal: string;
	repo_root: string | null;
	artifacts: string[];
	current_stage: string;
	stage_status: CreatorStageStatus;
	intent_packet: CreatorIntentPacket;
	benchmark_summary: {
		baseline_score: number | null;
		candidate_score: number | null;
		delta: number | null;
		held_out_pass: boolean;
	};
	swarm: {
		payload_ready: boolean;
		api_ready: boolean;
		publish_mode: CreatorPrivacyMode | 'none';
	};
	blockers: string[];
	links: {
		canvas: string;
		kanban: string;
		repo: string;
		pull_request: string;
	};
	created_at: string;
	updated_at: string;
}

export interface CreateCreatorMissionInput {
	brief: string;
	requestId?: string;
	missionId?: string;
	privacyMode?: CreatorPrivacyMode;
	riskLevel?: CreatorRiskLevel;
	baseUrl?: string;
}

export interface CreatorPlanOptions {
	builderRepo?: string;
	pythonCommand?: string;
	timeoutMs?: number;
	envRecord?: Record<string, string | undefined>;
}

interface CreateCreatorMissionOptions extends CreatorPlanOptions {
	stateDir?: string;
	now?: () => Date;
	runPlanner?: (input: CreateCreatorMissionInput) => Promise<CreatorIntentPacket>;
}

type CreatorPlanRunner = (
	input: CreateCreatorMissionInput,
	options?: CreatorPlanOptions
) => Promise<CreatorIntentPacket>;

let activeCreatorPlanRunner: CreatorPlanRunner | null = null;

export function setCreatorPlanRunnerForTests(runner: CreatorPlanRunner | null): void {
	activeCreatorPlanRunner = runner;
}

function spawnerStateDir(): string {
	return process.env.SPAWNER_STATE_DIR || env.SPAWNER_STATE_DIR || path.join(process.cwd(), '.spawner');
}

function creatorMissionDir(stateDir = spawnerStateDir()): string {
	return path.join(stateDir, 'creator-missions');
}

export function creatorMissionPath(missionId: string, stateDir = spawnerStateDir()): string {
	return path.join(creatorMissionDir(stateDir), `${missionId}.json`);
}

function defaultBuilderRepo(envRecord: Record<string, string | undefined> = env): string {
	return path.resolve(
		envRecord.SPARK_BUILDER_REPO ||
			process.env.SPARK_BUILDER_REPO ||
			path.join(process.cwd(), '..', 'spark-intelligence-builder')
	);
}

function defaultPythonCommand(envRecord: Record<string, string | undefined> = env): string {
	return envRecord.SPARK_BUILDER_PYTHON || process.env.SPARK_BUILDER_PYTHON || 'python';
}

function buildPlannerArgs(input: CreateCreatorMissionInput): string[] {
	const args = [
		'-m',
		'spark_intelligence.cli',
		'creator',
		'plan',
		'--brief',
		input.brief,
		'--json'
	];
	if (input.privacyMode) {
		args.push('--privacy-mode', input.privacyMode);
	}
	if (input.riskLevel) {
		args.push('--risk-level', input.riskLevel);
	}
	return args;
}

function withBuilderPythonPath(baseEnv: NodeJS.ProcessEnv, builderRepo: string): NodeJS.ProcessEnv {
	const srcPath = path.join(builderRepo, 'src');
	const delimiter = path.delimiter;
	const existing = baseEnv.PYTHONPATH;
	return {
		...baseEnv,
		PYTHONIOENCODING: 'utf-8',
		PYTHONPATH: existsSync(srcPath) ? (existing ? `${srcPath}${delimiter}${existing}` : srcPath) : existing
	};
}

function validateCreatorIntentPacket(value: unknown): CreatorIntentPacket {
	if (!value || typeof value !== 'object') {
		throw new Error('creator plan returned non-object JSON');
	}
	const packet = value as CreatorIntentPacket;
	if (packet.schema_version !== CREATOR_INTENT_SCHEMA_VERSION) {
		throw new Error(`creator plan returned unexpected schema: ${String((value as Record<string, unknown>).schema_version)}`);
	}
	if (!packet.user_goal || !packet.target_domain || !packet.desired_outputs) {
		throw new Error('creator plan returned incomplete intent packet');
	}
	return packet;
}

export async function runCreatorPlan(
	input: CreateCreatorMissionInput,
	options: CreatorPlanOptions = {}
): Promise<CreatorIntentPacket> {
	const envRecord = options.envRecord || env;
	const builderRepo = path.resolve(options.builderRepo || defaultBuilderRepo(envRecord));
	if (!existsSync(builderRepo)) {
		throw new Error(`Builder repo not found: ${builderRepo}`);
	}
	const pythonCommand = options.pythonCommand || defaultPythonCommand(envRecord);
	const { stdout } = await execFileAsync(pythonCommand, buildPlannerArgs(input), {
		cwd: builderRepo,
		env: withBuilderPythonPath(process.env, builderRepo),
		timeout: options.timeoutMs ?? 30_000,
		windowsHide: true,
		maxBuffer: 1024 * 1024
	});
	return validateCreatorIntentPacket(JSON.parse(stdout));
}

export function creatorModeFromIntent(packet: CreatorIntentPacket): CreatorMode {
	const outputs = packet.desired_outputs;
	if (outputs.domain_chip && outputs.specialization_path && outputs.benchmark_pack && outputs.autoloop_policy) {
		return 'full_path';
	}
	if (outputs.autoloop_policy) return 'autoloop';
	if (outputs.specialization_path) return 'specialization_path';
	if (outputs.benchmark_pack && !outputs.domain_chip) return 'benchmark';
	return 'domain_chip';
}

export function artifactPlanFromIntent(packet: CreatorIntentPacket): string[] {
	const outputs = packet.desired_outputs;
	const artifacts: string[] = [];
	if (outputs.domain_chip) artifacts.push('domain_chip');
	if (outputs.benchmark_pack) artifacts.push('benchmark_pack');
	if (outputs.specialization_path) artifacts.push('specialization_path');
	if (outputs.autoloop_policy) artifacts.push('autoloop_policy');
	if (outputs.telegram_flow) artifacts.push('telegram_flow');
	if (outputs.spawner_mission) artifacts.push('spawner_mission');
	if (outputs.swarm_publish_packet) artifacts.push('swarm_publish_packet');
	return artifacts;
}

export async function createCreatorMission(
	input: CreateCreatorMissionInput,
	options: CreateCreatorMissionOptions = {}
): Promise<CreatorMissionTrace> {
	const brief = input.brief?.trim();
	if (!brief) {
		throw new Error('brief is required');
	}
	const now = options.now?.() ?? new Date();
	const createdAt = now.toISOString();
	const missionId = input.missionId?.trim() || `mission-creator-${Date.now()}`;
	const requestId = input.requestId?.trim() || missionId;
	const planner = options.runPlanner || activeCreatorPlanRunner || runCreatorPlan;
	const intentPacket = await planner({ ...input, brief }, options);
	const baseUrl = input.baseUrl?.replace(/\/+$/, '') || '';
	const trace: CreatorMissionTrace = {
		schema_version: CREATOR_TRACE_SCHEMA_VERSION,
		mission_id: missionId,
		request_id: requestId,
		creator_mode: creatorModeFromIntent(intentPacket),
		user_goal: brief,
		repo_root: null,
		artifacts: artifactPlanFromIntent(intentPacket),
		current_stage: 'intent_packet_created',
		stage_status: 'validated',
		intent_packet: intentPacket,
		benchmark_summary: {
			baseline_score: null,
			candidate_score: null,
			delta: null,
			held_out_pass: false
		},
		swarm: {
			payload_ready: false,
			api_ready: false,
			publish_mode: intentPacket.privacy_mode === 'swarm_shared' ? 'swarm_shared' : intentPacket.privacy_mode
		},
		blockers: [],
		links: {
			canvas: '',
			kanban: baseUrl ? `${baseUrl}/kanban?mission=${encodeURIComponent(missionId)}` : '',
			repo: '',
			pull_request: ''
		},
		created_at: createdAt,
		updated_at: createdAt
	};
	await saveCreatorMissionTrace(trace, options.stateDir);
	return trace;
}

export async function saveCreatorMissionTrace(trace: CreatorMissionTrace, stateDir = spawnerStateDir()): Promise<void> {
	const dir = creatorMissionDir(stateDir);
	await mkdir(dir, { recursive: true });
	await writeFile(creatorMissionPath(trace.mission_id, stateDir), JSON.stringify(trace, null, 2), 'utf-8');
}

export async function readCreatorMissionTrace(
	input: { missionId?: string | null; requestId?: string | null },
	stateDir = spawnerStateDir()
): Promise<CreatorMissionTrace | null> {
	const missionId = input.missionId?.trim();
	if (missionId) {
		const filePath = creatorMissionPath(missionId, stateDir);
		if (!existsSync(filePath)) return null;
		return JSON.parse(await readFile(filePath, 'utf-8')) as CreatorMissionTrace;
	}
	const requestId = input.requestId?.trim();
	if (!requestId) return null;
	const dir = creatorMissionDir(stateDir);
	if (!existsSync(dir)) return null;
	for (const file of await readdir(dir)) {
		if (!file.endsWith('.json')) continue;
		const trace = JSON.parse(await readFile(path.join(dir, file), 'utf-8')) as CreatorMissionTrace;
		if (trace.request_id === requestId) return trace;
	}
	return null;
}
