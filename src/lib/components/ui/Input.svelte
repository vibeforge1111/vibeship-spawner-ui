<script lang="ts">
	interface Props {
		type?: 'text' | 'email' | 'password' | 'url' | 'search' | 'number';
		value?: string;
		placeholder?: string;
		label?: string;
		error?: string;
		disabled?: boolean;
		id?: string;
		name?: string;
		class?: string;
		oninput?: (e: Event) => void;
		onkeydown?: (e: KeyboardEvent) => void;
	}

	let {
		type = 'text',
		value = $bindable(''),
		placeholder = '',
		label = '',
		error = '',
		disabled = false,
		id = '',
		name = '',
		class: className = '',
		oninput,
		onkeydown
	}: Props = $props();
</script>

<div class="w-full">
	{#if label}
		<label for={id} class="block text-xs text-text-tertiary mb-1 font-mono">{label}</label>
	{/if}
	<input
		{type}
		{id}
		{name}
		{placeholder}
		{disabled}
		bind:value
		{oninput}
		{onkeydown}
		class="input {className}"
		class:border-status-error={error}
		class:focus:border-status-error={error}
	/>
	{#if error}
		<p class="mt-1 text-xs text-status-error">{error}</p>
	{/if}
</div>
