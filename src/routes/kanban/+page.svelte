<script lang="ts">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import MissionBoard from '$lib/components/MissionBoard.svelte';
</script>

<svelte:head>
	<title>Kanban · spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary flex flex-col">
	<Navbar />
	<main class="flex-1 mx-auto w-full max-w-[180rem] px-4 sm:px-6 lg:px-8 py-8">
		<MissionBoard />
	</main>
	<Footer />
</div>
