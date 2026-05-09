import { readFile } from 'fs/promises';
import { homedir } from 'os';
import path from 'path';

export type VoiceReadinessStatus = 'ready' | 'configured' | 'partial' | 'blocked' | 'unknown';

export interface VoiceSystemMetric {
	id: string;
	label: string;
	value: string;
	help: string;
	status: VoiceReadinessStatus;
}

export interface VoiceSystemRuntimeStep {
	id: string;
	label: string;
	owner: string;
	status: VoiceReadinessStatus;
	detail: string;
}

export interface VoiceSystemProvider {
	id: string;
	label: string;
	role: string;
	status: VoiceReadinessStatus;
	detail: string;
}

export interface VoiceSystemBoundary {
	owner: string;
	owns: string;
	notOwner: string;
}

export interface VoiceSystemDashboard {
	generatedAt: string;
	isSampleData: boolean;
	sourceLabel: string;
	warnings: string[];
	profile: {
		agentLabel: string;
		telegramProfile: string;
		preferenceScope: string;
		voiceName: string;
		providerLabel: string;
		voiceIdMasked: string;
		audioEffect: string;
	};
	metrics: VoiceSystemMetric[];
	runtimePath: VoiceSystemRuntimeStep[];
	providers: VoiceSystemProvider[];
	boundaries: VoiceSystemBoundary[];
	checks: string[];
	telegramCommands: string[];
	lastDelivery: {
		status: string;
		method: string;
		when: string;
		detail: string;
	};
}

const SNAPSHOT_RELATIVE_PATH = path.join('.spark', 'state', 'voice-system', 'dashboard.json');

export async function loadVoiceSystemDashboard(): Promise<VoiceSystemDashboard> {
	const snapshotPath = process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT || path.join(homedir(), SNAPSHOT_RELATIVE_PATH);
	try {
		const raw = await readFile(snapshotPath, 'utf-8');
		return normalizeVoiceSystemDashboard(JSON.parse(raw), snapshotPath);
	} catch {
		return sampleVoiceSystemDashboard(snapshotPath);
	}
}

export function normalizeVoiceSystemDashboard(raw: unknown, sourcePath = 'voice dashboard snapshot'): VoiceSystemDashboard {
	const value = isRecord(raw) ? raw : {};
	const profile = isRecord(value.profile) ? value.profile : {};
	const lastDelivery = isRecord(value.lastDelivery) ? value.lastDelivery : {};
	return {
		generatedAt: stringValue(value.generatedAt) || new Date().toISOString(),
		isSampleData: Boolean(value.isSampleData),
		sourceLabel: stringValue(value.sourceLabel) || sourcePath,
		warnings: stringArray(value.warnings),
		profile: {
			agentLabel: stringValue(profile.agentLabel) || 'Current Spark agent',
			telegramProfile: stringValue(profile.telegramProfile) || 'default',
			preferenceScope: stringValue(profile.preferenceScope) || 'this DM',
			voiceName: stringValue(profile.voiceName) || 'Not selected',
			providerLabel: stringValue(profile.providerLabel) || 'Unknown provider',
			voiceIdMasked: stringValue(profile.voiceIdMasked) || 'not shown',
			audioEffect: stringValue(profile.audioEffect) || 'none'
		},
		metrics: metricArray(value.metrics),
		runtimePath: runtimeStepArray(value.runtimePath),
		providers: providerArray(value.providers),
		boundaries: boundaryArray(value.boundaries),
		checks: stringArray(value.checks),
		telegramCommands: stringArray(value.telegramCommands),
		lastDelivery: {
			status: stringValue(lastDelivery.status) || 'unknown',
			method: stringValue(lastDelivery.method) || 'not recorded',
			when: stringValue(lastDelivery.when) || 'not recorded',
			detail: stringValue(lastDelivery.detail) || 'No Telegram delivery evidence has been recorded yet.'
		}
	};
}

export function sampleVoiceSystemDashboard(sourcePath = path.join(homedir(), SNAPSHOT_RELATIVE_PATH)): VoiceSystemDashboard {
	return {
		generatedAt: new Date().toISOString(),
		isSampleData: true,
		sourceLabel: `Sample view; waiting for ${sourcePath}`,
		warnings: ['Live voice dashboard snapshot is not connected yet. Ask Spark in Telegram for `/voice dashboard`.'],
		profile: {
			agentLabel: 'Current Spark agent',
			telegramProfile: 'default',
			preferenceScope: 'this agent, Telegram profile, and DM',
			voiceName: 'Elise or Kokoro, depending on local setup',
			providerLabel: 'ElevenLabs / Kokoro / GPT Realtime 2',
			voiceIdMasked: 'masked',
			audioEffect: 'none'
		},
		metrics: [
			{
				id: 'conversation-ready',
				label: 'Conversation ready',
				value: 'Needs proof',
				help: 'Requires STT, Builder answer, TTS, and Telegram delivery in one turn.',
				status: 'partial'
			},
			{
				id: 'preference-scope',
				label: 'Voice scope',
				value: 'Agent scoped',
				help: 'Voice tuning should not leak across agents or named Telegram profiles.',
				status: 'ready'
			},
			{
				id: 'secret-boundary',
				label: 'Secret boundary',
				value: 'Protected',
				help: 'Provider keys stay in local config or Spark secrets, not Telegram.',
				status: 'ready'
			}
		],
		runtimePath: [
			{
				id: 'telegram-in',
				label: 'Telegram input',
				owner: 'Telegram bot',
				status: 'configured',
				detail: 'Receives text, voice, and audio messages from the operator surface.'
			},
			{
				id: 'builder',
				label: 'Builder answer',
				owner: 'Spark Intelligence Builder',
				status: 'ready',
				detail: 'Owns routing, memory context, personality, and final answer composition.'
			},
			{
				id: 'voice-chip',
				label: 'Speech I/O',
				owner: 'spark-voice-comms',
				status: 'configured',
				detail: 'Transcribes audio and synthesizes the Builder-authored spoken answer.'
			},
			{
				id: 'telegram-out',
				label: 'Voice delivery',
				owner: 'Telegram delivery',
				status: 'partial',
				detail: 'Only proven after Telegram sendVoice succeeds for this chat.'
			}
		],
		providers: [
			{ id: 'elevenlabs', label: 'ElevenLabs', role: 'Hosted polished TTS', status: 'configured', detail: 'Best path for natural voice calibration.' },
			{ id: 'kokoro', label: 'Kokoro', role: 'Local/free neural TTS', status: 'configured', detail: 'Private local voice path when model assets are connected.' },
			{ id: 'openai-realtime', label: 'GPT Realtime 2', role: 'OpenAI hosted voice', status: 'configured', detail: 'Useful for expressive OpenAI-native setups.' }
		],
		boundaries: [
			{ owner: 'Builder', owns: 'answer, memory context, character, voice preference scope', notOwner: 'provider credentials or Telegram tokens' },
			{ owner: 'spark-voice-comms', owns: 'STT, TTS, audio bytes, provider readiness', notOwner: 'personality, memory, or Telegram delivery proof' },
			{ owner: 'Telegram bot', owns: 'message ingress and sendVoice delivery', notOwner: 'voice provider selection' }
		],
		checks: [
			'/voice reports the intended provider readiness',
			'/voice provider shows the expected preference scope',
			'/voice ask generates an answer before speaking',
			'/voice reply on sends matching text and audio',
			'switching one agent voice does not change another profile'
		],
		telegramCommands: ['/voice', '/voice provider', '/voice map', '/voice dashboard', '/voice ask <question>', '/voice reply on'],
		lastDelivery: {
			status: 'not recorded',
			method: 'sendVoice',
			when: 'waiting for first live snapshot',
			detail: 'The live snapshot will show whether Telegram delivery has actually succeeded.'
		}
	};
}

function metricArray(value: unknown): VoiceSystemMetric[] {
	if (!Array.isArray(value)) return sampleVoiceSystemDashboard('').metrics;
	return value.filter(isRecord).map((item) => ({
		id: stringValue(item.id) || 'metric',
		label: stringValue(item.label) || 'Metric',
		value: stringValue(item.value) || 'Unknown',
		help: stringValue(item.help) || '',
		status: readinessStatus(item.status)
	}));
}

function runtimeStepArray(value: unknown): VoiceSystemRuntimeStep[] {
	if (!Array.isArray(value)) return sampleVoiceSystemDashboard('').runtimePath;
	return value.filter(isRecord).map((item) => ({
		id: stringValue(item.id) || 'step',
		label: stringValue(item.label) || 'Step',
		owner: stringValue(item.owner) || 'Spark',
		status: readinessStatus(item.status),
		detail: stringValue(item.detail) || ''
	}));
}

function providerArray(value: unknown): VoiceSystemProvider[] {
	if (!Array.isArray(value)) return sampleVoiceSystemDashboard('').providers;
	return value.filter(isRecord).map((item) => ({
		id: stringValue(item.id) || 'provider',
		label: stringValue(item.label) || 'Provider',
		role: stringValue(item.role) || 'Voice provider',
		status: readinessStatus(item.status),
		detail: stringValue(item.detail) || ''
	}));
}

function boundaryArray(value: unknown): VoiceSystemBoundary[] {
	if (!Array.isArray(value)) return sampleVoiceSystemDashboard('').boundaries;
	return value.filter(isRecord).map((item) => ({
		owner: stringValue(item.owner) || 'Spark',
		owns: stringValue(item.owns) || '',
		notOwner: stringValue(item.notOwner) || ''
	}));
}

function stringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => stringValue(item)).filter(Boolean);
}

function readinessStatus(value: unknown): VoiceReadinessStatus {
	const normalized = stringValue(value).toLowerCase();
	if (['ready', 'configured', 'partial', 'blocked', 'unknown'].includes(normalized)) {
		return normalized as VoiceReadinessStatus;
	}
	return 'unknown';
}

function stringValue(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
