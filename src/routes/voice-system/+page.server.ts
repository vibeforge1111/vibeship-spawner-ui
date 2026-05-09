import { loadVoiceSystemDashboard } from '$lib/services/voice-system';

export async function load() {
	const dashboard = await loadVoiceSystemDashboard();
	return { dashboard };
}
