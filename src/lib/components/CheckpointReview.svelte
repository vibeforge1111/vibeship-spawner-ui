<script lang="ts">
	import type { ProjectCheckpoint } from '$lib/services/checkpoint';

	interface Props {
		checkpoint: ProjectCheckpoint;
		onVerify?: () => void;
		onReject?: (reason: string) => void;
	}

	let { checkpoint, onVerify, onReject }: Props = $props();

	let rejectReason = $state('');
	let showRejectForm = $state(false);
	let rerunning = $state(false);
	let rerunResult = $state<{ build: boolean; typecheck: boolean; test: boolean; duration: number } | null>(null);
	let rerunError = $state<string | null>(null);

	async function handleRerunVerification() {
		if (!checkpoint.missionName) return;
		const projectPath = (checkpoint as { projectPath?: string }).projectPath
			|| (checkpoint as unknown as { missionId: string }).missionId;

		rerunning = true;
		rerunError = null;
		rerunResult = null;

		try {
			const resp = await fetch('/api/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'scan',
					projectPath: projectPath || '.'
				})
			});

			if (!resp.ok) {
				const err = await resp.json();
				rerunError = err.error || 'Verification failed';
				return;
			}

			const data = await resp.json();
			rerunResult = {
				build: data.build?.success ?? false,
				typecheck: data.typecheck?.success ?? false,
				test: data.test?.success ?? true,
				duration: data.duration || 0
			};

			// Update checkpoint server verification in place
			if (checkpoint.serverVerification) {
				if (data.build) checkpoint.serverVerification.build = { success: data.build.success, output: data.build.stdout || '', duration: data.build.duration || 0 };
				if (data.typecheck) checkpoint.serverVerification.typecheck = { success: data.typecheck.success, errorCount: data.typecheck.errorCount || 0, output: data.typecheck.stdout || '', duration: data.typecheck.duration || 0 };
				if (data.test) checkpoint.serverVerification.test = { success: data.test.success, passed: data.test.passed || 0, failed: data.test.failed || 0, hasTestScript: data.test.hasTestScript ?? false, duration: data.test.duration || 0 };
			}
		} catch (err) {
			rerunError = err instanceof Error ? err.message : String(err);
		} finally {
			rerunning = false;
		}
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'success': return '✅';
			case 'partial': return '⚠️';
			case 'failed': return '❌';
			default: return '❓';
		}
	}

	function formatDuration(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		return `${hours}h ${mins}m`;
	}

	function formatBoolResult(value: boolean | null): string {
		if (value === null) return '—';
		return value ? '✅ Passed' : '❌ Failed';
	}

	function handleReject() {
		if (rejectReason.trim()) {
			onReject?.(rejectReason);
		}
	}
</script>

<div class="bg-surface-secondary border border-surface-border p-4 space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<span class="text-3xl">{getStatusIcon(checkpoint.status)}</span>
			<div>
				<h2 class="text-xl font-mono">{checkpoint.missionName}</h2>
				<p class="text-sm text-text-secondary">
					Completed {checkpoint.completedAt.toLocaleString()} • {formatDuration(checkpoint.duration)}
				</p>
			</div>
		</div>
		<div class="text-right">
			<span class="text-lg font-mono uppercase {checkpoint.status === 'success' ? 'text-green-400' : checkpoint.status === 'partial' ? 'text-yellow-400' : 'text-red-400'}">
				{checkpoint.status}
			</span>
			<p class="text-sm text-text-secondary">
				Ship Ready: {checkpoint.canShip ? '✅ Yes' : '❌ No'}
			</p>
		</div>
	</div>

	<!-- Automated Results -->
	<div>
		<h3 class="font-mono text-lg mb-2">Automated Results</h3>
		<div class="grid grid-cols-2 md:grid-cols-4 gap-2">
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Tasks Completed</p>
				<p class="font-mono text-lg">{checkpoint.automated.tasksCompleted}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Tasks Failed</p>
				<p class="font-mono text-lg {checkpoint.automated.tasksFailed > 0 ? 'text-red-400' : ''}">{checkpoint.automated.tasksFailed}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Tests Passed</p>
				<p class="font-mono text-lg">{checkpoint.automated.testsPassed}/{checkpoint.automated.testsRun}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Build</p>
				<p class="font-mono">{formatBoolResult(checkpoint.automated.buildSucceeded)}</p>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-2 mt-2">
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Type Check</p>
				<p class="font-mono">{formatBoolResult(checkpoint.automated.typeCheckPassed)}</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Lint</p>
				<p class="font-mono">{formatBoolResult(checkpoint.automated.lintPassed)}</p>
			</div>
		</div>
	</div>

	<!-- Independent Verification (Server-Side) -->
	{#if checkpoint.serverVerification}
		<div>
			<div class="flex items-center justify-between mb-2">
				<h3 class="font-mono text-lg">Independent Verification</h3>
				<button
					class="px-3 py-1 text-xs font-mono uppercase tracking-wider border transition-colors {rerunning ? 'bg-surface-primary border-surface-border text-text-tertiary cursor-wait' : 'bg-accent-primary/10 border-accent-primary/30 text-accent-primary hover:bg-accent-primary/20'}"
					onclick={handleRerunVerification}
					disabled={rerunning}
				>
					{rerunning ? 'Running...' : 'Re-run Verification'}
				</button>
			</div>
			<div class="grid grid-cols-3 gap-2">
				<div class="bg-surface-primary p-2 border border-surface-border">
					<p class="text-text-secondary text-sm">Build</p>
					{#if checkpoint.serverVerification.build}
						<p class="font-mono {checkpoint.serverVerification.build.success ? 'text-green-400' : 'text-red-400'}">
							{checkpoint.serverVerification.build.success ? 'Passed' : 'Failed'}
						</p>
						<p class="text-[10px] text-text-tertiary font-mono">{(checkpoint.serverVerification.build.duration / 1000).toFixed(1)}s</p>
					{:else}
						<p class="font-mono text-text-tertiary">Not run</p>
					{/if}
				</div>
				<div class="bg-surface-primary p-2 border border-surface-border">
					<p class="text-text-secondary text-sm">Typecheck</p>
					{#if checkpoint.serverVerification.typecheck}
						<p class="font-mono {checkpoint.serverVerification.typecheck.success ? 'text-green-400' : 'text-red-400'}">
							{checkpoint.serverVerification.typecheck.success ? 'Passed' : `${checkpoint.serverVerification.typecheck.errorCount} errors`}
						</p>
						<p class="text-[10px] text-text-tertiary font-mono">{(checkpoint.serverVerification.typecheck.duration / 1000).toFixed(1)}s</p>
					{:else}
						<p class="font-mono text-text-tertiary">Not run</p>
					{/if}
				</div>
				<div class="bg-surface-primary p-2 border border-surface-border">
					<p class="text-text-secondary text-sm">Tests</p>
					{#if checkpoint.serverVerification.test}
						{#if checkpoint.serverVerification.test.hasTestScript}
							<p class="font-mono {checkpoint.serverVerification.test.success ? 'text-green-400' : 'text-red-400'}">
								{checkpoint.serverVerification.test.passed} passed, {checkpoint.serverVerification.test.failed} failed
							</p>
							<p class="text-[10px] text-text-tertiary font-mono">{(checkpoint.serverVerification.test.duration / 1000).toFixed(1)}s</p>
						{:else}
							<p class="font-mono text-text-tertiary">No test script</p>
						{/if}
					{:else}
						<p class="font-mono text-text-tertiary">Not run</p>
					{/if}
				</div>
			</div>
			{#if rerunResult}
				<div class="mt-2 px-2 py-1 bg-accent-primary/5 border border-accent-primary/20 text-xs text-accent-primary font-mono">
					Re-run complete ({(rerunResult.duration / 1000).toFixed(1)}s): Build {rerunResult.build ? 'OK' : 'FAIL'} | Typecheck {rerunResult.typecheck ? 'OK' : 'FAIL'} | Tests {rerunResult.test ? 'OK' : 'FAIL'}
				</div>
			{/if}
			{#if rerunError}
				<div class="mt-2 px-2 py-1 bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
					Re-run error: {rerunError}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Security Scan -->
	{#if checkpoint.securityScan}
		<div>
			<h3 class="font-mono text-lg mb-2">Security Scan</h3>
			<div class="grid grid-cols-4 gap-2 mb-2">
				<div class="bg-surface-primary p-2 border border-surface-border text-center">
					<p class="text-2xl font-mono {checkpoint.securityScan.criticalCount > 0 ? 'text-red-400' : 'text-green-400'}">{checkpoint.securityScan.criticalCount}</p>
					<p class="text-[10px] text-text-tertiary font-mono uppercase">Critical</p>
				</div>
				<div class="bg-surface-primary p-2 border border-surface-border text-center">
					<p class="text-2xl font-mono {checkpoint.securityScan.highCount > 0 ? 'text-orange-400' : 'text-green-400'}">{checkpoint.securityScan.highCount}</p>
					<p class="text-[10px] text-text-tertiary font-mono uppercase">High</p>
				</div>
				<div class="bg-surface-primary p-2 border border-surface-border text-center">
					<p class="text-2xl font-mono text-text-primary">{checkpoint.securityScan.totalFindings}</p>
					<p class="text-[10px] text-text-tertiary font-mono uppercase">Total</p>
				</div>
				<div class="bg-surface-primary p-2 border border-surface-border text-center">
					<p class="text-2xl font-mono {checkpoint.securityScan.canShip ? 'text-green-400' : 'text-red-400'}">{checkpoint.securityScan.canShip ? 'OK' : 'BLOCKED'}</p>
					<p class="text-[10px] text-text-tertiary font-mono uppercase">Ship</p>
				</div>
			</div>
			{#each checkpoint.securityScan.results as result}
				<div class="mb-1 px-2 py-1 bg-surface-primary border border-surface-border text-xs font-mono flex items-center gap-2">
					<span class="font-bold text-text-primary uppercase">{result.scanner}</span>
					{#if !result.available}
						<span class="text-text-tertiary">not installed</span>
					{:else if result.findings.length > 0}
						<span class="text-orange-400">{result.findings.length} finding{result.findings.length !== 1 ? 's' : ''}</span>
					{:else}
						<span class="text-green-400">clean</span>
					{/if}
					<span class="text-text-tertiary ml-auto">{(result.duration / 1000).toFixed(1)}s</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Quality Metrics -->
	<div>
		<h3 class="font-mono text-lg mb-2">Quality Metrics</h3>
		<div class="grid grid-cols-3 gap-2">
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Skill Usage</p>
				<p class="font-mono text-lg">{Math.round(checkpoint.quality.skillUsageRatio * 100)}%</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Avg Task Quality</p>
				<p class="font-mono text-lg">{Math.round(checkpoint.quality.averageTaskQuality)}/100</p>
			</div>
			<div class="bg-surface-primary p-2 border border-surface-border">
				<p class="text-text-secondary text-sm">Completion Rate</p>
				<p class="font-mono text-lg">{Math.round(checkpoint.quality.completionRate * 100)}%</p>
			</div>
		</div>
	</div>

	<!-- Known Issues -->
	{#if checkpoint.review.knownIssues.length > 0}
		<div>
			<h3 class="font-mono text-lg mb-2">Known Issues</h3>
			<div class="space-y-1">
				{#each checkpoint.review.knownIssues as issue}
					<div class="flex items-start gap-2 p-2 bg-yellow-900/20 border border-yellow-600/30">
						<span>⚠️</span>
						<span class="text-yellow-400">{issue}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Manual Testing Checklist -->
	{#if checkpoint.review.manualTestSuggestions.length > 0}
		<div>
			<h3 class="font-mono text-lg mb-2">Manual Testing Checklist</h3>
			<div class="space-y-4">
				{#each checkpoint.review.manualTestSuggestions as suggestion}
					<div>
						<h4 class="font-mono text-accent-primary mb-1">{suggestion.category}</h4>
						<div class="space-y-1">
							{#each suggestion.tests as test}
								<label class="flex items-center gap-2 p-1 hover:bg-surface-primary cursor-pointer">
									<input type="checkbox" class="form-checkbox" />
									<span class="text-sm">{test}</span>
								</label>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Summary -->
	<div class="p-3 bg-surface-primary border border-surface-border">
		<p class="text-text-secondary">{checkpoint.review.summary}</p>
	</div>

	<!-- Actions -->
	<div class="pt-4 border-t border-surface-border space-y-2">
		{#if !checkpoint.canShip}
			<div class="px-3 py-2 bg-red-500/10 border border-red-500/30 text-xs text-red-400 font-mono">
				Ship blocked:
				{#if checkpoint.serverVerification?.build && !checkpoint.serverVerification.build.success}
					Build failed.
				{/if}
				{#if checkpoint.serverVerification?.typecheck && !checkpoint.serverVerification.typecheck.success}
					Typecheck failed.
				{/if}
				{#if checkpoint.specAlignment && checkpoint.specAlignment.coverageRate < 0.8}
					Spec coverage below 80%.
				{/if}
				{#if checkpoint.quality.completionRate < 0.9}
					Completion rate below 90%.
				{/if}
				{#if checkpoint.status !== 'success'}
					Status: {checkpoint.status}.
				{/if}
				Re-run verification after fixing issues.
			</div>
		{/if}
		<div class="flex gap-2">
		{#if !showRejectForm}
			<button
				class="btn-primary px-6 py-2"
				onclick={onVerify}
				disabled={!checkpoint.canShip}
			>
				✅ Verify & Ship
			</button>
			<button
				class="btn-secondary px-6 py-2"
				onclick={() => showRejectForm = true}
			>
				❌ Needs Work
			</button>
		{:else}
			<div class="flex-1 flex gap-2">
				<input
					type="text"
					bind:value={rejectReason}
					placeholder="What needs to be fixed?"
					class="flex-1 px-3 py-2 bg-surface-primary border border-surface-border font-mono"
				/>
				<button
					class="btn-secondary px-4 py-2"
					onclick={handleReject}
					disabled={!rejectReason.trim()}
				>
					Submit
				</button>
				<button
					class="btn-ghost px-4 py-2"
					onclick={() => showRejectForm = false}
				>
					Cancel
				</button>
			</div>
		{/if}
	</div>
	</div>
</div>
