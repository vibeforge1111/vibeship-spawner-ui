<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';

	let scanTarget = $state('');
	let isScanning = $state(false);
	let scanResults = $state<{ category: string; issues: { title: string; severity: string; description: string }[] }[] | null>(null);

	async function handleScan() {
		if (!scanTarget.trim()) return;

		isScanning = true;
		scanResults = null;

		// Simulate scanning
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Demo results
		scanResults = [
			{
				category: 'Security',
				issues: [
					{ title: 'Exposed API Keys', severity: 'critical', description: 'Found potential API keys in source files' },
					{ title: 'Missing HTTPS', severity: 'warning', description: 'Some endpoints not using HTTPS' }
				]
			},
			{
				category: 'Dependencies',
				issues: [
					{ title: 'Outdated Packages', severity: 'warning', description: '5 packages have updates available' },
					{ title: 'Known Vulnerabilities', severity: 'high', description: '2 packages have known CVEs' }
				]
			},
			{
				category: 'Code Quality',
				issues: [
					{ title: 'Missing Error Handling', severity: 'info', description: 'Some async functions lack try/catch' }
				]
			}
		];

		isScanning = false;
	}

	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/50';
			case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/50';
			case 'warning': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50';
			default: return 'text-blue-500 bg-blue-500/10 border-blue-500/50';
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
					Scan your codebase for security issues, vulnerabilities, and best practice violations.
				</p>
			</div>

			<!-- Scanner Input -->
			<div class="mb-12 p-6 border border-surface-border bg-bg-secondary">
				<label for="scan-target" class="block text-sm text-text-tertiary mb-2">Repository URL or Path</label>
				<div class="flex gap-4">
					<input
						id="scan-target"
						type="text"
						bind:value={scanTarget}
						placeholder="https://github.com/user/repo or /path/to/project"
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
					<p class="text-text-secondary">Scanning for issues...</p>
				</div>
			{/if}

			<!-- Results -->
			{#if scanResults}
				<div class="space-y-6">
					{#each scanResults as category}
						<div class="border border-surface-border">
							<div class="p-4 border-b border-surface-border bg-bg-secondary">
								<div class="flex items-center justify-between">
									<h2 class="font-medium text-text-primary">{category.category}</h2>
									<span class="text-sm text-text-tertiary">{category.issues.length} issues</span>
								</div>
							</div>
							<div class="divide-y divide-surface-border">
								{#each category.issues as issue}
									<div class="p-4 flex items-start gap-4">
										<span class="px-2 py-0.5 text-xs font-mono border {getSeverityColor(issue.severity)}">
											{issue.severity.toUpperCase()}
										</span>
										<div class="flex-1">
											<h3 class="font-medium text-text-primary">{issue.title}</h3>
											<p class="text-sm text-text-secondary">{issue.description}</p>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Summary -->
				<div class="mt-8 p-6 border border-surface-border bg-bg-secondary">
					<h3 class="font-medium text-text-primary mb-4">Scan Summary</h3>
					<div class="grid grid-cols-4 gap-4 text-center">
						<div>
							<div class="text-2xl font-mono text-red-500">
								{scanResults.reduce((acc, c) => acc + c.issues.filter(i => i.severity === 'critical').length, 0)}
							</div>
							<div class="text-xs text-text-tertiary">Critical</div>
						</div>
						<div>
							<div class="text-2xl font-mono text-orange-500">
								{scanResults.reduce((acc, c) => acc + c.issues.filter(i => i.severity === 'high').length, 0)}
							</div>
							<div class="text-xs text-text-tertiary">High</div>
						</div>
						<div>
							<div class="text-2xl font-mono text-yellow-500">
								{scanResults.reduce((acc, c) => acc + c.issues.filter(i => i.severity === 'warning').length, 0)}
							</div>
							<div class="text-xs text-text-tertiary">Warning</div>
						</div>
						<div>
							<div class="text-2xl font-mono text-blue-500">
								{scanResults.reduce((acc, c) => acc + c.issues.filter(i => i.severity === 'info').length, 0)}
							</div>
							<div class="text-xs text-text-tertiary">Info</div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Features -->
			{#if !scanResults && !isScanning}
				<div class="grid md:grid-cols-2 gap-6">
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Security Analysis</h3>
						<p class="text-sm text-text-secondary">
							Detect exposed secrets, SQL injection, XSS vulnerabilities, and OWASP top 10 issues.
						</p>
					</div>
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Dependency Audit</h3>
						<p class="text-sm text-text-secondary">
							Check for known vulnerabilities in npm, pip, and other package managers.
						</p>
					</div>
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Code Quality</h3>
						<p class="text-sm text-text-secondary">
							Find anti-patterns, missing error handling, and code smells.
						</p>
					</div>
					<div class="p-6 border border-surface-border">
						<h3 class="font-mono text-accent-primary mb-2">Best Practices</h3>
						<p class="text-sm text-text-secondary">
							Ensure your code follows industry best practices and patterns.
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
