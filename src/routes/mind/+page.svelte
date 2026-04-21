<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	onMount(() => {
		goto('/missions', { replaceState: true });
	});
</script>

<div class="min-h-screen bg-bg-primary flex items-center justify-center px-6">
	<p class="font-mono text-sm text-text-tertiary">Redirecting to missions...</p>
</div>
