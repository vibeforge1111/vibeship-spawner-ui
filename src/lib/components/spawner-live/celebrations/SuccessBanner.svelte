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
		gap: 12px;
		padding: 16px 32px;
		border-radius: 12px;
		color: white;
		font-size: 18px;
		font-weight: 600;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		animation: banner-pop 0.3s ease-out;
	}

	.banner-icon {
		font-size: 24px;
	}

	.banner-message {
		max-width: 400px;
		text-align: center;
	}

	@keyframes banner-pop {
		0% {
			transform: scale(0.8);
			opacity: 0;
		}
		50% {
			transform: scale(1.05);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
