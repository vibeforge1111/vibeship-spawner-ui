<script lang="ts">
	import Navbar from './Navbar.svelte';
	import Footer from './Footer.svelte';
	import Icon from './Icon.svelte';

	const previewSurfaces = [
		{ name: 'Canvas', detail: 'visual mission planning', status: 'locked' },
		{ name: 'Kanban', detail: 'task progress board', status: 'locked' },
		{ name: 'Trace', detail: 'execution timeline', status: 'locked' },
		{ name: 'Skills', detail: 'agent capability library', status: 'locked' },
		{ name: 'Settings', detail: 'workspace controls', status: 'locked' }
	];

	const trustPoints = [
		'No public connection to your local agent',
		'No shared public mission console',
		'Workspace identity before app access',
		'Private Railway/VPS owners keep their own explicit preview path'
	];
</script>

<div class="min-h-screen bg-bg-primary text-text-primary">
	<Navbar publicPreviewLocked={true} />

	<main>
		<section class="border-b border-surface-border">
			<div class="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
				<div>
					<p class="font-mono text-xs font-semibold uppercase tracking-[0.26em] text-accent-primary">
						Private workspace preview
					</p>
					<h1 class="mt-5 max-w-3xl font-sans text-[42px] font-semibold leading-[1.02] tracking-tight text-text-primary md:text-[64px]">
						Spawner is not public access yet.
					</h1>
					<p class="mt-6 max-w-2xl text-lg leading-8 text-text-secondary">
						The hosted app surface is intentionally locked while account identity, workspace isolation, and agent-pairing safety are finished. The landing page is open; Canvas, Kanban, Trace, Skills, Settings, and APIs are not.
					</p>

					<div class="mt-8 flex flex-col gap-3 sm:flex-row">
						<a
							href="https://sparkswarm.ai/waitlist"
							class="inline-flex items-center justify-center gap-2 rounded-md border border-accent-primary/45 bg-accent-primary px-5 py-3 font-sans text-sm font-semibold text-accent-fg shadow-[0_0_28px_-16px_rgb(var(--accent-rgb))] transition hover:bg-accent-hover"
						>
							<Icon name="sparkles" size={16} />
							Join private access
						</a>
						<span class="inline-flex items-center justify-center gap-2 rounded-md border border-surface-border bg-bg-secondary px-5 py-3 font-sans text-sm font-semibold text-text-secondary">
							<Icon name="lock" size={16} />
							App surfaces locked
						</span>
					</div>
				</div>

				<section class="rounded-lg border border-surface-border bg-bg-secondary p-5 shadow-[0_24px_90px_-54px_rgb(var(--accent-rgb))]">
					<div class="flex items-center justify-between border-b border-surface-border pb-4">
						<div>
							<p class="font-mono text-xs uppercase tracking-[0.22em] text-text-tertiary">Workspace access</p>
							<h2 class="mt-2 font-sans text-xl font-semibold text-text-primary">Reserved account shell</h2>
						</div>
						<span class="rounded-md border border-accent-primary/35 bg-accent-primary/10 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent-primary">
							Locked
						</span>
					</div>

					<div class="mt-5 grid gap-4">
						<label class="grid gap-2">
							<span class="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Workspace ID</span>
							<input
								disabled
								value="private-workspace"
								class="rounded-md border border-surface-border bg-bg-primary px-4 py-3 font-mono text-sm text-text-tertiary outline-none"
								aria-label="Workspace ID preview"
							/>
						</label>
						<label class="grid gap-2">
							<span class="font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">Password</span>
							<input
								disabled
								type="password"
								value="not-live-yet"
								class="rounded-md border border-surface-border bg-bg-primary px-4 py-3 font-mono text-sm text-text-tertiary outline-none"
								aria-label="Password preview"
							/>
						</label>
						<button
							type="button"
							disabled
							class="mt-1 inline-flex items-center justify-center gap-2 rounded-md border border-surface-border bg-bg-primary px-4 py-3 font-sans text-sm font-semibold text-text-tertiary"
						>
							<Icon name="lock" size={15} />
							Access opens after security review
						</button>
					</div>

					<p class="mt-5 rounded-md border border-surface-border bg-bg-primary px-4 py-3 text-sm leading-6 text-text-secondary">
						This is a visible account placeholder, not a working login. We will not accept usernames or passwords until auth, sessions, tenant isolation, and agent pairing are ready.
					</p>
				</section>
			</div>
		</section>

		<section class="mx-auto max-w-6xl px-6 py-14">
			<div class="grid gap-4 md:grid-cols-5">
				{#each previewSurfaces as surface}
					<article class="rounded-lg border border-surface-border bg-bg-secondary p-4">
						<div class="flex items-start justify-between gap-3">
							<div>
								<h2 class="font-sans text-base font-semibold text-text-primary">{surface.name}</h2>
								<p class="mt-2 text-sm leading-6 text-text-secondary">{surface.detail}</p>
							</div>
							<Icon name="lock" size={16} class="text-accent-primary" />
						</div>
						<p class="mt-5 font-mono text-xs uppercase tracking-[0.18em] text-text-tertiary">{surface.status}</p>
					</article>
				{/each}
			</div>
		</section>

		<section class="border-y border-surface-border bg-bg-secondary/55">
			<div class="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
				<div>
					<p class="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-accent-primary">Safety posture</p>
					<h2 class="mt-4 font-sans text-3xl font-semibold leading-tight text-text-primary">
						The public host is a brochure until the workspace boundary is real.
					</h2>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each trustPoints as point}
						<div class="rounded-md border border-surface-border bg-bg-primary p-4">
							<div class="flex items-start gap-3">
								<span class="mt-1 h-2.5 w-2.5 rounded-full bg-accent-primary shadow-[0_0_18px_rgb(var(--accent-rgb)/0.55)]"></span>
								<p class="text-sm leading-6 text-text-secondary">{point}</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</section>
	</main>

	<Footer publicPreviewLocked={true} />
</div>

