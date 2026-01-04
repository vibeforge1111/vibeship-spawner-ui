<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'default' | 'elevated' | 'interactive';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
		header?: Snippet;
		footer?: Snippet;
	}

	let {
		variant = 'default',
		padding = 'md',
		class: className = '',
		onclick,
		children,
		header,
		footer
	}: Props = $props();

	const variantClasses = {
		default: 'panel',
		elevated: 'panel shadow-lg',
		interactive: 'panel vibe-card cursor-pointer hover:border-vibe-teal-border transition-all'
	};

	const paddingClasses = {
		none: '',
		sm: 'p-3',
		md: 'p-4',
		lg: 'p-6'
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="{variantClasses[variant]} {className}"
	{onclick}
>
	{#if header}
		<div class="px-4 py-3 border-b border-surface-border">
			{@render header()}
		</div>
	{/if}

	<div class={paddingClasses[padding]}>
		{@render children()}
	</div>

	{#if footer}
		<div class="px-4 py-3 border-t border-surface-border bg-bg-primary/50">
			{@render footer()}
		</div>
	{/if}
</div>
