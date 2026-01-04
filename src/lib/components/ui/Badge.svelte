<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
		size?: 'sm' | 'md';
		class?: string;
		children: Snippet;
	}

	let {
		variant = 'neutral',
		size = 'md',
		class: className = '',
		children
	}: Props = $props();

	const variantClasses = {
		success: 'badge-success',
		warning: 'badge-warning',
		error: 'badge-error',
		info: 'badge-info',
		neutral: 'badge bg-surface text-text-secondary border border-surface-border'
	};

	const sizeClasses = {
		sm: 'text-[10px] px-1.5 py-0.5',
		md: 'text-xs px-2 py-0.5'
	};
</script>

<span class="{variantClasses[variant]} {sizeClasses[size]} {className}">
	{@render children()}
</span>
