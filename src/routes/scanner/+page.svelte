<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { runSecurityScan, type ScanResponse, type ScanResult } from '$lib/services/scanner';

	let scanTarget = $state('');
	let isScanning = $state(false);
	let scanResponse = $state<ScanResponse | null>(null);
	let scanError = $state<string | null>(null);

	async function handleScan() {
		if (!scanTarget.trim()) return;

		isScanning = true;
		scanResponse = null;
		scanError = null;

		try {
			scanResponse = await runSecurityScan({ projectPath: scanTarget.trim() });
		} catch (err) {
			scanError = err instanceof Error ? err.message : String(err);
		} finally {
			isScanning = false;
		}
	}

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/50';
			case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/50';
			case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50';
			case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/50';
			default: return 'text-blue-500 bg-blue-500/10 border-blue-500/50';
		}
	}

	function getScannerLabel(scanner: string): string {
		switch (scanner) {
			case 'gitleaks': return 'Gitleaks (Secret Detection)';
			case 'trivy': return 'Trivy (CVE Scanner)';
			case 'opengrep': return 'OpenGrep (SAST)';
			default: return scanner;
		}
	}
</script>

<svelte:head>
	<title>Security Scanner - Vibeship Spawner</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-bg-primary">
	<Navbar />

	<main class="flex-1 py-16">
		<div class="max-w-4xl mx-auto px-6">
			<!-- Header -->
			<div class="text-center mb-12">
				<h1 class="font-serif text-4xl text-text-primary mb-4">Security Scanner</h1>
				<p class="text-text-secondary text-lg max-w-2xl mx-auto">
					Scan your codebase for secrets, vulnerabilities, and code issues using Gitleaks, Trivy, and OpenGrep.
				</p>
			</div>

			<!-- Scanner Input -->
			<div class="mb-12 p-6 border border-surface-border bg-bg-secondary">
				<label for="scan-target" class="block text-sm text-text-tertiary mb-2">Project Path (absolute)</label>
				<div class="flex gap-4">
					<input
						id="scan-target"
						type="text"
						bind:value={scanTarget}
						placeholder="C:\Users\USER\Desktop\my-project"
						class="flex-1 px-4 py-2 bg-surface border border-surface-border text-text-primary font-mono focus:outline-none focus:border-accent-primary"
					/>
					<button
						onclick={handleScan}
						disabled={isScanning || !scanTarget.trim()}
						class="px-6 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isScanning ? 'Scanning...' : 'Scan'}
					</button>
				</div>
			</div>

			<!-- Scanning Animation -->
			{#if isScanning}
				<div class="text-center py-12">
					<div class="inline-block w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin mb-4"></div>
					<p class="text-text-secondary">Running security scanners...</p>
					<p class="text-xs text-text-tertiary mt-1">Gitleaks + Trivy + OpenGrep (up to 60s each)</p>
				</div>
			{/if}

			<!-- Error -->
			{#if scanError}
				<div class="p-4 bg-red-500/10 border border-red-500/30 text-red-400 font-mono text-sm mb-6">
					{scanError}
				</div>
			{/if}

			<!-- Results -->
			{#if scanResponse}
				<!-- Summary Bar -->
				<div class="mb-6 p-4 border border-surface-border bg-bg-secondary flex items-center justify-between">
					<div class="flex items-center gap-4">
						<span class="text-lg font-mono {scanResponse.canShip ? 'text-green-400' : 'text-red-400'}">
							{scanResponse.canShip ? 'CLEAR' : 'BLOCKED'}
						</span>
						<span class="text-text-tertiary text-sm">{scanResponse.totalFindings} findings in {(scanResponse.duration / 1000).toFixed(1)}s</span>
					</div>
					<div class="flex gap-4 text-center">
						<div>
							<div class="text-xl font-mono text-red-500">{scanResponse.criticalCount}</div>
							<div class="text-[10px] text-text-tertiary uppercase">Critical</div>
						</div>
						<div>
							<div class="text-xl font-mono text-orange-500">{scanResponse.highCount}</div>
							<div class="text-[10px] text-text-tertiary uppercase">High</div>
						</div>
					</div>
				</div>

				<!-- Per-Scanner Results -->
				<div class="space-y-6">
					{#each scanResponse.results as result}
						<div class="border border-surface-border">
							<div class="p-4 border-b border-surface-border bg-bg-secondary">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2">
										<h2 class="font-medium text-text-primary">{getScannerLabel(result.scanner)}</h2>
										{#if !result.available}
											<span class="px-2 py-0.5 text-[10px] font-mono bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 uppercase">Not Installed</span>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-sm text-text-tertiary">
										<span>{(result.duration / 1000).toFixed(1)}s</span>
										{#if result.available}
											<span class="font-mono">{result.findings.length} findings</span>
										{/if}
									</div>
								</div>
								{#if result.error && !result.available}
									<p class="text-xs text-text-tertiary mt-1">Install: {result.scanner === 'gitleaks' ? 'brew install gitleaks' : result.scanner === 'trivy' ? 'brew install trivy' : 'pip install opengrep'}</p>
								{/if}
							</div>
							{#if result.findings.length > 0}
								<div class="divide-y divide-surface-border">
									{#each result.findings as finding}
										<div class="p-4 flex items-start gap-4">
											<span class="px-2 py-0.5 text-xs font-mono border shrink-0 {getSeverityColor(finding.severity)}">
												{finding.severity.toUpperCase()}
											</span>
											<div class="flex-1 min-w-0">
												<h3 class="font-medium text-text-primary text-sm">{finding.title}</h3>
												<p class="text-sm text-text-secondary">{finding.description}</p>
												{#if finding.file}
													<p class="text-xs text-text-tertiary font-mono mt-1">{finding.file}{finding.line ? `:${finding.line}` : ''}</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{:else if result.available}
								<div class="p-4 text-center text-green-400 text-sm font-mono">No issues found</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Features -->
			{#if !scanResponse && !isScanning && !scanError}
				<div class="grid md:grid-cols-3 gap-6">
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Gitleaks</h3>
						<p class="text-sm text-text-secondary">
							Detect hardcoded secrets, API keys, tokens, and credentials in your source code.
						</p>
					</div>
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Trivy</h3>
						<p class="text-sm text-text-secondary">
							Scan dependencies for known CVEs. Checks npm, pip, and other package managers.
						</p>
					</div>
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">OpenGrep</h3>
						<p class="text-sm text-text-secondary">
							Static analysis for anti-patterns, injection vulnerabilities, and code quality issues.
						</p>
					</div>
				</div>

				<!-- Powered By -->
				<div class="mt-12 text-center text-sm text-text-tertiary">
					<p>Powered by OpenGrep, Trivy, and GitLeaks</p>
				</div>
			{/if}
		</div>
	</main>

	<Footer />
</div>
