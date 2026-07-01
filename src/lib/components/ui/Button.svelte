<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'primary' | 'secondary' | 'ghost';
		size?: 'sm' | 'md' | 'lg';
		disabled?: boolean;
		loading?: boolean;
		type?: 'button' | 'submit' | 'reset';
		title?: string;
		ariaLabel?: string;
		onclick?: (e: MouseEvent) => void;
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		type = 'button',
		title = '',
		ariaLabel = '',
		onclick,
		class: className = '',
		children
	}: Props = $props();

	const variantClasses = {
		primary: 'btn-primary',
		secondary: 'btn-secondary',
		ghost: 'btn-ghost'
	};

	const sizeClasses = {
		sm: 'btn-sm',
		md: 'btn-md',
		lg: 'btn-lg'
	};
</script>

<button
	{type}
	{disabled}
	{onclick}
	title={title || undefined}
	aria-label={ariaLabel || undefined}
	class="{variantClasses[variant]} {sizeClasses[size]} {className}"
	class:opacity-50={disabled || loading}
	class:cursor-not-allowed={disabled || loading}
>
	{#if loading}
		<span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
	{/if}
	{@render children()}
</button>
