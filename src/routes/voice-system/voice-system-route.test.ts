import { readFile, writeFile, mkdir } from 'fs/promises';
import os from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { loadVoiceSystemDashboard, normalizeVoiceSystemDashboard } from '$lib/services/voice-system';

describe('/voice-system route', () => {
	it('renders the expected one-page voice dashboard regions', async () => {
		const routeSource = await readFile(path.join(process.cwd(), 'src/routes/voice-system/+page.svelte'), 'utf-8');

		expect(routeSource).toContain('Telegram voice runtime');
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
		process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = path.join(os.tmpdir(), `missing-voice-dashboard-${Date.now()}.json`);
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
		process.env.SPARK_VOICE_SYSTEM_DASHBOARD_SNAPSHOT = snapshotPath;
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
		}
	});
});

async function fsTempDir() {
	const base = path.join(os.tmpdir(), `voice-system-${Date.now()}-${Math.random().toString(16).slice(2)}`);
	await mkdir(base, { recursive: true });
	return base;
}
