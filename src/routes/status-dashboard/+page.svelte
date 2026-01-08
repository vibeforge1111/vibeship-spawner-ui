<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		getServices,
		getStats,
		getIsPolling,
		startPolling,
		stopPolling,
		addService,
		removeService
	} from '$lib/stores/services.svelte';
	import type { Service, DashboardStats } from '$lib/types/dashboard';
	import ServiceCard from '$lib/components/dashboard/ServiceCard.svelte';
	import AddServiceForm from '$lib/components/dashboard/AddServiceForm.svelte';

	let services = $state<Service[]>([]);
	let stats = $state<DashboardStats | null>(null);
	let isPolling = $state(false);
	let showAddForm = $state(false);
	let selectedService = $state<Service | null>(null);

	// Update state from store
	$effect(() => {
		const interval = setInterval(() => {
			services = getServices();
			stats = getStats();
			isPolling = getIsPolling();
		}, 1000);

		return () => clearInterval(interval);
	});

	onMount(() => {
		services = getServices();
		stats = getStats();
		isPolling = getIsPolling();

		// Auto-start polling
		startPolling();
	});

	onDestroy(() => {
		// Don't stop polling on unmount - let it continue in background
	});

	function handleAddService(event: CustomEvent<{ name: string; url: string; description?: string }>) {
		const { name, url, description } = event.detail;
		addService(name, url, description);
		showAddForm = false;
	}

	function handleRemoveService(serviceId: string) {
		if (confirm('Are you sure you want to remove this service?')) {
			removeService(serviceId);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'healthy': return 'bg-green-500';
			case 'degraded': return 'bg-yellow-500';
			case 'down': return 'bg-red-500';
			default: return 'bg-gray-500';
		}
	}
</script>

<svelte:head>
	<title>Status Dashboard | Spawner</title>
</svelte:head>

<div class="min-h-screen bg-bg-primary p-6">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-2xl font-serif text-text-primary">System Status Dashboard</h1>
			<p class="text-sm text-text-secondary mt-1">Real-time monitoring of your services</p>
		</div>
		<div class="flex items-center gap-4">
			<!-- Polling Status -->
			<div class="flex items-center gap-2">
				<div class="w-2 h-2 rounded-full {isPolling ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}"></div>
				<span class="text-xs font-mono text-text-tertiary">
					{isPolling ? 'LIVE' : 'PAUSED'}
				</span>
			</div>

			<!-- Toggle Polling -->
			<button
				onclick={() => isPolling ? stopPolling() : startPolling()}
				class="px-3 py-1.5 text-xs font-mono border border-surface-border hover:border-text-tertiary transition-all"
			>
				{isPolling ? 'Pause' : 'Resume'}
			</button>

			<!-- Add Service Button -->
			<button
				onclick={() => showAddForm = true}
				class="px-4 py-1.5 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
			>
				+ Add Service
			</button>
		</div>
	</div>

	<!-- Stats Overview -->
	{#if stats}
		<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Total</p>
				<p class="text-2xl font-mono text-text-primary">{stats.totalServices}</p>
			</div>
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Healthy</p>
				<p class="text-2xl font-mono text-green-400">{stats.healthyServices}</p>
			</div>
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Degraded</p>
				<p class="text-2xl font-mono text-yellow-400">{stats.degradedServices}</p>
			</div>
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Down</p>
				<p class="text-2xl font-mono text-red-400">{stats.downServices}</p>
			</div>
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Avg Response</p>
				<p class="text-2xl font-mono text-text-primary">{stats.averageResponseTime}ms</p>
			</div>
			<div class="p-4 bg-bg-secondary border border-surface-border">
				<p class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Uptime</p>
				<p class="text-2xl font-mono text-accent-primary">{stats.overallUptime}%</p>
			</div>
		</div>
	{/if}

	<!-- Services Grid -->
	{#if services.length === 0}
		<div class="flex flex-col items-center justify-center py-16 text-center">
			<div class="w-16 h-16 mb-4 flex items-center justify-center bg-surface border border-surface-border rounded-full">
				<svg class="w-8 h-8 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
				</svg>
			</div>
			<h3 class="text-lg font-serif text-text-primary mb-2">No Services Monitored</h3>
			<p class="text-sm text-text-secondary mb-4">Add your first service to start monitoring</p>
			<button
				onclick={() => showAddForm = true}
				class="px-4 py-2 text-sm font-mono bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all"
			>
				Add Service
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each services as service (service.id)}
				<ServiceCard
					{service}
					onRemove={() => handleRemoveService(service.id)}
					onSelect={() => selectedService = service}
				/>
			{/each}
		</div>
	{/if}
</div>

<!-- Add Service Modal -->
{#if showAddForm}
	<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onclick={() => showAddForm = false}>
		<div class="bg-bg-secondary border border-surface-border p-6 w-full max-w-md" onclick={(e) => e.stopPropagation()}>
			<h2 class="text-lg font-serif text-text-primary mb-4">Add New Service</h2>
			<AddServiceForm
				onSubmit={handleAddService}
				onCancel={() => showAddForm = false}
			/>
		</div>
	</div>
{/if}
