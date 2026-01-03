<script lang="ts">
	import Welcome from '$lib/components/Welcome.svelte';
	import { goto } from '$app/navigation';

	function handleStart() {
		goto('/canvas');
	}
</script>

<Welcome onStart={handleStart} />
