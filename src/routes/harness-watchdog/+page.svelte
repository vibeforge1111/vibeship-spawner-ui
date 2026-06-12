<script lang="ts">
	import { onMount } from 'svelte';
	import Footer from '$lib/components/Footer.svelte';
	import HarnessWatchdogProbeBoard from '$lib/components/HarnessWatchdogProbeBoard.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import type { WatchdogProbeBoard } from '$lib/services/harness-watchdog';

	let requestId = $state('');
	let missionId = $state('');
	let board = $state<WatchdogProbeBoard | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	function apiUrl(): string {
		const params = new URLSearchParams();
		if (requestId.trim()) params.set('requestId', requestId.trim());
		if (missionId.trim()) params.set('missionId', missionId.trim());
		const query = params.toString();
		return `/api/harness-watchdog/probe${query ? `?${query}` : ''}`;
	}

	async function loadBoard(): Promise<void> {
		loading = true;
		error = null;
		try {
			const response = await fetch(apiUrl());
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				throw new Error(payload?.error || `Probe request failed (${response.status})`);
			}
			board = payload as WatchdogProbeBoard;
			requestId = board.requestId ?? requestId;
			missionId = board.missionId ?? missionId;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unable to load harness watchdog probe';
		} finally {
			loading = false;
		}
	}

	function applyUrlParams(): void {
		const params = new URLSearchParams(window.location.search);
		requestId = params.get('requestId') || '';
		missionId = params.get('missionId') || params.get('mission') || '';
	}

	onMount(() => {
		applyUrlParams();
		void loadBoard();
	});
</script>

<svelte:head>
	<title>Harness Watchdog Probe Board · spawner</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg-primary">
	<Navbar />
	<main class="mx-auto w-full max-w-[110rem] flex-1 px-4 py-6 sm:px-6 lg:px-8">
		<HarnessWatchdogProbeBoard {board} {loading} {error} />
	</main>
	<Footer />
</div>
