<script lang="ts">
	import Welcome from '$lib/components/Welcome.svelte';
	import { setGoalInput } from '$lib/stores/project-goal.svelte';

	function handleStart(goal: string) {
		// Store the goal before navigating
		setGoalInput(goal);
		// Force full page reload to avoid Svelte reactivity issues
		// Client-side navigation causes canvas to become unresponsive
		window.location.href = '/canvas';
	}
</script>

<Welcome onStart={handleStart} />
