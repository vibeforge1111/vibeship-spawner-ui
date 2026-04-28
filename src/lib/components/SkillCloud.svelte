<!--
	Live skill cloud — pulls real skill names from /skills.json and renders
	them as a slowly-marqueeing wall to make "600+ skills" tangible.
-->
<script lang="ts">
	import { onMount } from 'svelte';

	type SkillMeta = { id: string; name?: string; category?: string };

	let skills = $state<string[]>([]);
	let total = $state(0);

	onMount(async () => {
		try {
			const r = await fetch('/skills.json');
			const data: SkillMeta[] = await r.json();
			total = data.length;
			// Take a varied sample so the cloud has visual variety
			const names = data
				.map((s) => s.name || s.id)
				.filter((n) => n && n.length < 32);
			// Shuffle and take 80
			const sample: string[] = [];
			const used = new Set<number>();
			while (sample.length < Math.min(80, names.length)) {
				const i = Math.floor(Math.random() * names.length);
				if (used.has(i)) continue;
				used.add(i);
				sample.push(names[i]);
			}
			skills = sample;
		} catch (e) {
			// Fallback: a curated set so the cloud always renders
			total = 600;
			skills = [
				'sveltekit', 'react', 'nextjs', 'frontend', 'backend',
				'api-design', 'graphql', 'postgres', 'redis', 'kubernetes',
				'security-owasp', 'opengrep', 'solidity', 'web3-contracts', 'defi',
				'ml-ops', 'rag', 'prompt-eng', 'fine-tuning', 'embeddings',
				'marketing', 'xcontent', 'voice-style', 'virality', 'scheduling',
				'figma', 'ui-design', 'tailwind', 'animation', 'a11y',
				'trading', 'risk', 'execution', 'options', 'futures',
				'aws', 'gcp', 'cloudflare', 'terraform', 'docker',
				'pytest', 'playwright', 'cypress', 'k6', 'lighthouse',
				'sql', 'dbt', 'airflow', 'kafka', 'spark',
				'rust', 'go', 'python', 'typescript', 'wasm',
				'compliance', 'gdpr', 'sox', 'hipaa', 'pci',
				'docs', 'changelog', 'rfc', 'adr', 'runbook'
			];
		}
	});
</script>

<div class="relative overflow-hidden rounded-lg border border-surface-border bg-bg-secondary py-10">
	<!-- Top + bottom gradient masks for depth -->
	<div class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-bg-secondary to-transparent z-10"></div>
	<div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg-secondary to-transparent z-10"></div>
	<div class="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg-secondary to-transparent z-10"></div>
	<div class="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg-secondary to-transparent z-10"></div>

	<!-- Total badge -->
	<div class="absolute top-4 right-4 z-20 rounded-full border border-accent-primary/40 bg-accent-primary/10 px-3 py-1">
		<span class="font-mono text-xs text-accent-primary tracking-widest">{total > 0 ? `${total}+` : '600+'} SKILLS</span>
	</div>

	<!-- Three rows of marqueeing chips, opposite directions -->
	<div class="space-y-3">
		{#each [0, 1, 2] as row}
			<div class="flex gap-3 marquee" class:reverse={row === 1} style="--duration: {110 + row * 14}s">
				{#each [...skills.slice(row * 25, row * 25 + 30), ...skills.slice(row * 25, row * 25 + 30)] as skill, i (row + '-' + i)}
					<span class="shrink-0 inline-flex items-center px-3 py-1.5 rounded-full border border-surface-border bg-bg-primary font-mono text-sm text-text-secondary whitespace-nowrap">
						{skill}
					</span>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.marquee {
		animation: scroll var(--duration, 60s) linear infinite;
		width: max-content;
	}
	.marquee.reverse {
		animation-direction: reverse;
	}
	@keyframes scroll {
		from { transform: translateX(0); }
		to { transform: translateX(-50%); }
	}
</style>
