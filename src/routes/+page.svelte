<script lang="ts">
	import Welcome from '$lib/components/Welcome.svelte';
	import { setGoalInput, setPipelineOptions } from '$lib/stores/project-goal.svelte';

	let { data }: { data: { publicPreviewLocked: boolean } } = $props();

	function handleStart(goal: string, options?: { includeSkills?: boolean; includeMCPs?: boolean }) {
		// Store the goal before navigating
		setGoalInput(goal);
		// Store pipeline options if provided
		if (options) {
			setPipelineOptions({
				includeSkills: options.includeSkills !== false,
				includeMCPs: options.includeMCPs !== false
			});
		}
		// Force full page reload to avoid Svelte reactivity issues
		// Client-side navigation causes canvas to become unresponsive
		window.location.href = '/canvas';
	}
</script>

<Welcome onStart={handleStart} publicPreviewLocked={data.publicPreviewLocked} />
