<script lang="ts">
	import { activeBanner } from '$lib/spawner-live/effects';
	import { fly, fade } from 'svelte/transition';

	function getTypeStyles(type: string) {
		switch (type) {
			case 'success':
				return { bg: '#22c55e', icon: '✓' };
			case 'error':
				return { bg: '#ef4444', icon: '✕' };
			case 'warning':
				return { bg: '#f59e0b', icon: '⚠' };
			case 'info':
			default:
				return { bg: '#3b82f6', icon: 'ℹ' };
		}
	}
</script>

{#if $activeBanner}
	{@const styles = getTypeStyles($activeBanner.type)}
	<div
		class="banner-overlay"
		class:top={$activeBanner.position === 'top'}
		class:center={$activeBanner.position === 'center'}
		class:bottom={$activeBanner.position === 'bottom'}
		in:fly={{ y: $activeBanner.position === 'bottom' ? 50 : -50, duration: 300 }}
		out:fade={{ duration: 200 }}
	>
		<div class="banner" style="background: {styles.bg}">
			<span class="banner-icon">{styles.icon}</span>
			<span class="banner-message">{$activeBanner.message}</span>
		</div>
	</div>
{/if}

<style>
	.banner-overlay {
		position: fixed;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		z-index: 10000;
		pointer-events: none;
	}

	.banner-overlay.top {
		top: 20px;
	}

	.banner-overlay.center {
		top: 50%;
		transform: translateY(-50%);
	}

	.banner-overlay.bottom {
		bottom: 20px;
	}

	.banner {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 24px;
		border-radius: 6px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		font-family: var(--font-mono, monospace);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	}

	.banner-icon {
		font-size: 16px;
	}

	.banner-message {
		max-width: 400px;
	}
</style>
