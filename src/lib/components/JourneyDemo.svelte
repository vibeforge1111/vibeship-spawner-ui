<!--
	Animated journey: prompt → tasks → skills → ship
	Cycles through 3 example missions to show how the same flow handles
	any kind of work. Pure CSS keyframes driven by a single $state cycle.
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	type Example = {
		prompt: string;
		tasks: { title: string; skills: string[] }[];
	};

	const EXAMPLES: Example[] = [
		{
			prompt: 'Build a landing page for my SaaS',
			tasks: [
				{ title: 'Design a layout', skills: ['ui-design', 'web3-ui'] },
				{ title: 'Build the page', skills: ['frontend', 'sveltekit'] },
				{ title: 'Wire the form', skills: ['backend', 'api-design'] }
			]
		},
		{
			prompt: 'Audit my smart contract',
			tasks: [
				{ title: 'Static analysis', skills: ['security-owasp', 'opengrep'] },
				{ title: 'Reentrancy check', skills: ['solidity', 'web3-contracts'] },
				{ title: 'Write the report', skills: ['compliance', 'docs'] }
			]
		},
		{
			prompt: 'Launch a content campaign',
			tasks: [
				{ title: 'Find the angle', skills: ['marketing', 'xcontent'] },
				{ title: 'Draft 10 posts', skills: ['copywriting', 'voice-style'] },
				{ title: 'Schedule + score', skills: ['scheduling', 'virality'] }
			]
		}
	];

	let cycle = $state(0);
	// Start at "done" so the first paint shows the full journey populated;
	// then the loop walks back through prompt -> tasks -> skills -> done.
	let step = $state(3);
	let timer: ReturnType<typeof setInterval> | null = null;

	const current = $derived(EXAMPLES[cycle % EXAMPLES.length]);

	onMount(() => {
		// First user-facing animation kicks in after a short hold so they
		// can register the full picture before it resets and replays.
		setTimeout(() => {
			cycle = 1;
			step = 0;
			const PHASE_MS = 2200;
			timer = setInterval(() => {
				step += 1;
				if (step > 3) {
					step = 0;
					cycle += 1;
				}
			}, PHASE_MS);
		}, 3500);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

<div class="rounded-lg border border-surface-border bg-bg-secondary p-8 md:p-12 overflow-hidden">
	<!-- Phase 1: prompt -->
	<div class="mb-10">
		<p class="font-mono text-xs text-text-tertiary tracking-widest mb-3">YOU SAY</p>
		<div class="rounded-md border border-surface-border bg-bg-primary px-5 py-4 min-h-[64px] flex items-center">
			{#key cycle}
				<p class="text-xl md:text-2xl font-sans text-text-primary leading-tight prompt-typing">
					{current.prompt}
				</p>
			{/key}
		</div>
	</div>

	<!-- Phase 2: tasks materialize -->
	<div class="mb-10">
		<p class="font-mono text-xs text-text-tertiary tracking-widest mb-3">
			SPAWNER BREAKS IT DOWN
			<span class="text-accent-primary ml-2" class:opacity-0={step < 1}>↓</span>
		</p>
		<div class="grid md:grid-cols-3 gap-3">
			{#each current.tasks as task, i (cycle + '-' + i)}
				<div
					class="rounded-md border border-surface-border bg-bg-primary p-4 transition-all duration-500"
					class:task-in={step >= 1}
					class:task-pre={step < 1}
					style="--delay: {i * 120}ms"
				>
					<p class="font-mono text-[10px] text-accent-primary tracking-widest mb-2">TASK {i + 1}</p>
					<p class="text-base font-sans text-text-primary leading-snug">{task.title}</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Phase 3: skills couple in -->
	<div class="mb-10">
		<p class="font-mono text-xs text-text-tertiary tracking-widest mb-3">
			RIGHT SKILL FOR EACH TASK
			<span class="text-accent-primary ml-2" class:opacity-0={step < 2}>↓</span>
		</p>
		<div class="grid md:grid-cols-3 gap-3">
			{#each current.tasks as task, i (cycle + '-skills-' + i)}
				<div class="flex flex-wrap gap-2">
					{#each task.skills as skill, j}
						<span
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-accent-primary/40 bg-accent-primary/10 transition-all duration-500"
							class:skill-in={step >= 2}
							class:skill-pre={step < 2}
							style="--delay: {(i * 200) + (j * 100)}ms"
						>
							<span class="w-1.5 h-1.5 rounded-full bg-accent-primary" class:pulse={step >= 2}></span>
							<span class="font-mono text-sm text-text-primary">{skill}</span>
						</span>
					{/each}
				</div>
			{/each}
		</div>
	</div>

	<!-- Phase 4: ship -->
	<div>
		<p class="font-mono text-xs text-text-tertiary tracking-widest mb-3">RESULT</p>
		<div
			class="rounded-md border bg-bg-primary px-5 py-4 transition-all duration-500"
			class:done-in={step >= 3}
			class:done-pre={step < 3}
		>
			<div class="flex items-center gap-3">
				<span class="text-accent-primary text-2xl leading-none" class:check-pop={step >= 3}>✓</span>
				<p class="text-lg font-sans text-text-primary">Mission shipped — track it on the kanban.</p>
			</div>
		</div>
	</div>

	<!-- Progress dots -->
	<div class="mt-10 flex items-center justify-center gap-2">
		{#each EXAMPLES as _, i}
			<button
				type="button"
				aria-label="Show example {i + 1}"
				class="h-1 rounded-full transition-all duration-300"
				class:bg-accent-primary={(cycle % EXAMPLES.length) === i}
				class:bg-surface-border={(cycle % EXAMPLES.length) !== i}
				class:w-8={(cycle % EXAMPLES.length) === i}
				class:w-3={(cycle % EXAMPLES.length) !== i}
				onclick={() => { cycle = i; step = 0; }}
			></button>
		{/each}
	</div>
</div>

<style>
	.task-pre {
		opacity: 0;
		transform: translateY(8px);
	}
	.task-in {
		opacity: 1;
		transform: translateY(0);
		transition-delay: var(--delay);
		border-color: rgb(var(--accent-rgb) / 0.5);
		box-shadow: 0 0 0 1px rgb(var(--accent-rgb) / 0.1);
	}

	.skill-pre {
		opacity: 0;
		transform: scale(0.9);
	}
	.skill-in {
		opacity: 1;
		transform: scale(1);
		transition-delay: var(--delay);
	}

	.done-pre {
		opacity: 0.4;
		border-color: rgb(var(--border-rgb));
	}
	.done-in {
		opacity: 1;
		border-color: rgb(var(--accent-rgb) / 0.6);
		background: rgb(var(--accent-rgb) / 0.05);
	}

	.check-pop {
		animation: pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	@keyframes pop {
		0% { transform: scale(0); }
		60% { transform: scale(1.3); }
		100% { transform: scale(1); }
	}

	.pulse {
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.prompt-typing {
		animation: type-in 0.8s ease-out;
	}
	@keyframes type-in {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}
</style>
