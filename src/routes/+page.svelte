<script lang="ts">
	import Welcome from '$lib/components/Welcome.svelte';
	import { goto } from '$app/navigation';
	import { setGoalInput } from '$lib/stores/project-goal.svelte';

	function handleStart(goal: string) {
		// Store the goal before navigating
		setGoalInput(goal);
		goto('/canvas');
	}
</script>

<Welcome onStart={handleStart} />
