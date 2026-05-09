import { readFile, writeFile, mkdir } from 'fs/promises';
import { DatabaseSync } from 'node:sqlite';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { loadVoiceSystemDashboard, normalizeVoiceSystemDashboard } from '$lib/services/voice-system';

describe('/voice-system route', () => {
	it('renders the expected one-page voice dashboard regions', async () => {
		const routeSource = await readFile(path.join(process.cwd(), 'src/routes/voice-system/+page.svelte'), 'utf-8');

		expect(routeSource).toContain('Telegram voice runtime');
		expect(routeSource).toContain('Voice proof ladder');
		expect(routeSource).toContain('Voice profile and runtime path');
		expect(routeSource).toContain('Voice readiness metrics');
		expect(routeSource).toContain('Provider readiness');
		expect(routeSource).toContain('Last Telegram delivery');
		expect(routeSource).toContain('Ownership boundaries');
		expect(routeSource).toContain('Production checks');
		expect(routeSource).toContain('Telegram commands');
	});

	it('loads a clearly marked sample dashboard when no snapshot exists', async () => {
		const previous = process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT;
		const previousBuilderDb = process.env.SPARK_BUILDER_STATE_DB;
		process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = path.join(os.tmpdir(), `missing-voice-dashboard-${Date.now()}.json`);
		process.env.SPARK_BUILDER_STATE_DB = path.join(os.tmpdir(), `missing-builder-state-${Date.now()}.db`);
		try {
			const dashboard = await loadVoiceSystemDashboard();

			expect(dashboard.isSampleData).toBe(true);
			expect(dashboard.warnings[0]).toContain('/voice dashboard');
			expect(dashboard.metrics.map((metric) => metric.id)).toContain('preference-scope');
			expect(dashboard.runtimePath).toHaveLength(4);
			expect(dashboard.telegramCommands).toContain('/voice provider');
		} finally {
			if (previous === undefined) {
				delete process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT;
			} else {
				process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = previous;
			}
			if (previousBuilderDb === undefined) {
				delete process.env.SPARK_BUILDER_STATE_DB;
			} else {
				process.env.SPARK_BUILDER_STATE_DB = previousBuilderDb;
			}
		}
	});

	it('normalizes live snapshots without exposing raw secret fields', async () => {
		const tempDir = await fsTempDir();
		const snapshotPath = path.join(tempDir, 'dashboard.json');
		await writeFile(
			snapshotPath,
			JSON.stringify({
				generatedAt: '2026-05-09T12:00:00.000Z',
				isSampleData: false,
				sourceLabel: 'Builder voice snapshot',
				profile: {
					agentLabel: 'Tester',
					telegramProfile: 'default',
					preferenceScope: 'this agent, Telegram profile, and DM',
					voiceName: 'Elise',
					providerLabel: 'ElevenLabs',
					voiceIdMasked: 'voic...lise',
					audioEffect: 'none'
				},
				metrics: [{ id: 'delivery-ready', label: 'Delivery ready', value: 'Yes', help: 'sendVoice worked', status: 'ready' }],
				runtimePath: [{ id: 'builder', label: 'Builder answer', owner: 'Builder', status: 'ready', detail: 'Canonical answer generated.' }],
				providers: [{ id: 'elevenlabs', label: 'ElevenLabs', role: 'Hosted TTS', status: 'ready', detail: 'Configured.' }],
				boundaries: [{ owner: 'Builder', owns: 'answer', notOwner: 'secrets' }],
				checks: ['/voice provider'],
				telegramCommands: ['/voice dashboard'],
				lastDelivery: { status: 'success', method: 'sendVoice', when: '2026-05-09T12:00:00Z', detail: 'Telegram message id present.' },
				secretValue: 'must-not-render'
			}),
			'utf-8'
		);

		const previous = process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT;
		const previousBuilderDb = process.env.SPARK_BUILDER_STATE_DB;
		process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = snapshotPath;
		process.env.SPARK_BUILDER_STATE_DB = path.join(tempDir, 'missing-builder-state.db');
		try {
			const dashboard = await loadVoiceSystemDashboard();
			const normalized = normalizeVoiceSystemDashboard({ secretValue: 'hidden' });

			expect(dashboard.isSampleData).toBe(false);
			expect(dashboard.profile.voiceName).toBe('Elise');
			expect(JSON.stringify(dashboard)).not.toContain('must-not-render');
			expect(JSON.stringify(normalized)).not.toContain('hidden');
		} finally {
			if (previous === undefined) {
				delete process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT;
			} else {
				process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = previous;
			}
			if (previousBuilderDb === undefined) {
				delete process.env.SPARK_BUILDER_STATE_DB;
			} else {
				process.env.SPARK_BUILDER_STATE_DB = previousBuilderDb;
			}
		}
	});

	it('overlays live Builder voice delivery proof without requiring a dashboard refresh', async () => {
		const tempDir = await fsTempDir();
		const snapshotPath = path.join(tempDir, 'dashboard.json');
		const builderHome = path.join(tempDir, 'builder-home');
		await mkdir(builderHome, { recursive: true });
		await writeFile(
			snapshotPath,
			JSON.stringify({
				generatedAt: '2026-05-09T10:02:35.000Z',
				isSampleData: false,
				sourceLabel: 'Builder voice snapshot',
				warnings: ['sendVoice delivery has not been proven yet.', 'Speech synthesis still needs proof.'],
				metrics: [
					{ id: 'conversation-ready', label: 'Conversation ready', value: 'Needs proof', help: 'full path', status: 'partial' },
					{ id: 'delivery-ready', label: 'Delivery ready', value: 'Needs proof', help: 'sendVoice', status: 'partial' },
					{ id: 'tts-ready', label: 'TTS ready', value: 'Configured', help: 'synthesis', status: 'configured' },
					{ id: 'stt-ready', label: 'STT ready', value: 'Configured', help: 'transcription', status: 'configured' }
				],
				runtimePath: [
					{ id: 'voice-chip', label: 'Speech I/O', owner: 'spark-voice-comms', status: 'configured', detail: 'Synthesis configured.' },
					{ id: 'telegram-out', label: 'Voice delivery', owner: 'Telegram delivery', status: 'partial', detail: 'Needs proof.' }
				],
				providers: [],
				boundaries: [],
				checks: [],
				telegramCommands: [],
				lastDelivery: { status: 'not recorded', method: 'sendVoice', when: 'waiting', detail: 'No proof yet.' }
			}),
			'utf-8'
		);
		const db = new DatabaseSync(path.join(builderHome, 'state.db'));
		try {
			db.exec('CREATE TABLE runtime_state (state_key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)');
			db.prepare('INSERT INTO runtime_state (state_key, value, updated_at) VALUES (?, ?, ?)').run(
				'telegram:voice:last_runtime_state',
				JSON.stringify({
					stt: { provider_id: 'openai', ready: true },
					tts: { provider_id: 'elevenlabs', ready: true },
					claim_levels: { synthesis_ready: true, delivery_ready: true, conversation_ready: true },
					telegram_delivery: {
						ready: true,
						last_send_voice_at: '2026-05-09T10:07:08.247Z',
						last_send_voice_status: 'success',
						last_failure_reason: '',
						telegram_message_id_present: true,
						send_method: 'sendVoice'
					},
					source_ledger: ['voice.speak', 'telegram-runner-sendVoice-trace']
				}),
				'2026-05-09T10:07:08.247Z'
			);
			db.prepare('INSERT INTO runtime_state (state_key, value, updated_at) VALUES (?, ?, ?)').run(
				'telegram:voice_tts_profile:operator',
				JSON.stringify({
					provider_id: 'elevenlabs',
					secret_env_ref: 'ELEVENLABS_API_KEY',
					voice_id: 'fixtureVoiceId123456789',
					voice_name: 'Elise - Warm, Natural and Engaging',
					model_id: 'eleven_turbo_v2_5'
				}),
				'2026-05-09T10:08:08.247Z'
			);
		} finally {
			db.close();
		}

		const previousSnapshot = process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT;
		const previousBuilderHome = process.env.SPARK_BUILDER_HOME;
		const previousBuilderDb = process.env.SPARK_BUILDER_STATE_DB;
		process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = snapshotPath;
		process.env.SPARK_BUILDER_HOME = builderHome;
		delete process.env.SPARK_BUILDER_STATE_DB;
		try {
			const dashboard = await loadVoiceSystemDashboard();

			expect(dashboard.lastDelivery.status).toBe('success');
			expect(dashboard.lastDelivery.method).toBe('sendVoice');
			expect(dashboard.lastDelivery.detail).toContain('message id');
			expect(dashboard.sourceLabel).toContain('runtime delivery proof');
			expect(dashboard.sourceLabel).toContain('runtime voice profile');
			expect(dashboard.profile.providerLabel).toBe('ElevenLabs');
			expect(dashboard.profile.voiceName).toBe('Elise - Warm, Natural and Engaging');
			expect(dashboard.profile.voiceIdMasked).toBe('fixt...6789');
			expect(dashboard.metrics.find((metric) => metric.id === 'delivery-ready')?.status).toBe('ready');
			expect(dashboard.metrics.find((metric) => metric.id === 'conversation-ready')?.status).toBe('ready');
			expect(dashboard.runtimePath.find((step) => step.id === 'telegram-out')?.status).toBe('ready');
			expect(dashboard.warnings).toEqual([]);
			expect(JSON.stringify(dashboard)).not.toContain('invalid_api_key');
			expect(JSON.stringify(dashboard)).not.toContain('ELEVENLABS_API_KEY');
			expect(JSON.stringify(dashboard)).not.toContain('fixtureVoiceId123456789');
		} finally {
			if (previousSnapshot === undefined) {
				delete process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT;
			} else {
				process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = previousSnapshot;
			}
			if (previousBuilderHome === undefined) {
				delete process.env.SPARK_BUILDER_HOME;
			} else {
				process.env.SPARK_BUILDER_HOME = previousBuilderHome;
			}
			if (previousBuilderDb === undefined) {
				delete process.env.SPARK_BUILDER_STATE_DB;
			} else {
				process.env.SPARK_BUILDER_STATE_DB = previousBuilderDb;
			}
		}
	});
});

async function fsTempDir() {
	const base = path.join(os.tmpdir(), `voice-system-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	await mkdir(base, { recursive: true });
	return base;
}
