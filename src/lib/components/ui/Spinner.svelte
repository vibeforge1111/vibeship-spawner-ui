<script lang="ts">
	interface Props {
		size?: 'sm' | 'md' | 'lg';
		color?: 'primary' | 'secondary' | 'white';
		class?: string;
	}

	let {
		size = 'md',
		color = 'primary',
		class: className = ''
	}: Props = $props();

	const sizeClasses = {
		sm: 'w-4 h-4 border-2',
		md: 'w-6 h-6 border-2',
		lg: 'w-8 h-8 border-3'
	};

	const colorClasses = {
		primary: 'border-accent-primary border-t-transparent',
		secondary: 'border-text-tertiary border-t-transparent',
		white: 'border-white border-t-transparent'
	};
</script>

<span
	class="inline-block rounded-full animate-spin {sizeClasses[size]} {colorClasses[color]} {className}"
	role="status"
	aria-label="Loading"
></span>
