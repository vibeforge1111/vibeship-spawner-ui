<script lang="ts">
	import { messages, isProcessing, sendMessage, clearChat, type ChatMessage } from '$lib/stores/chat.svelte';
	import { mcpState } from '$lib/stores/mcp.svelte';

	let inputValue = $state('');
	let messagesContainer: HTMLDivElement;
	let currentMessages = $state<ChatMessage[]>([]);
	let processing = $state(false);
	let mcpStatus = $state<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');

	$effect(() => {
		const unsub1 = messages.subscribe((m) => (currentMessages = m));
		const unsub2 = isProcessing.subscribe((p) => (processing = p));
		const unsub3 = mcpState.subscribe((s) => (mcpStatus = s.status));
		return () => {
			unsub1();
			unsub2();
			unsub3();
		};
	});

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		if (currentMessages.length > 0 && messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!inputValue.trim() || processing) return;

		const message = inputValue;
		inputValue = '';
		await sendMessage(message);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e);
		}
	}

	function formatTime(date: Date): string {
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<div class="flex flex-col h-full">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-2 border-b border-surface-border">
		<div class="flex items-center gap-2">
			<span class="font-mono text-sm text-text-primary">Chat</span>
			<span
				class="w-2 h-2 rounded-full"
				class:bg-accent-primary={mcpStatus === 'connected'}
				class:bg-yellow-500={mcpStatus === 'connecting'}
				class:bg-red-500={mcpStatus === 'error'}
				class:bg-text-tertiary={mcpStatus === 'disconnected'}
			></span>
		</div>
		{#if currentMessages.length > 0}
			<button
				onclick={clearChat}
				class="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
			>
				Clear
			</button>
		{/if}
	</div>

	<!-- Messages -->
	<div bind:this={messagesContainer} class="flex-1 overflow-y-auto p-4 space-y-3">
		{#if currentMessages.length === 0}
			<div class="text-center py-8">
				<p class="text-sm text-text-tertiary mb-2">No messages yet</p>
				<p class="text-xs text-text-tertiary">
					Try <code class="bg-surface px-1">/help</code> to see commands
				</p>
			</div>
		{:else}
			{#each currentMessages as message (message.id)}
				<div
					class="flex flex-col gap-1"
					class:items-end={message.role === 'user'}
				>
					<div
						class="max-w-[85%] px-3 py-2 text-sm"
						class:bg-accent-primary={message.role === 'user'}
						class:text-bg-primary={message.role === 'user'}
						class:bg-surface={message.role === 'assistant'}
						class:text-text-primary={message.role === 'assistant'}
						class:bg-surface-hover={message.role === 'system'}
						class:text-text-secondary={message.role === 'system'}
						class:border={message.role !== 'user'}
						class:border-surface-border={message.role !== 'user'}
					>
						{#if message.isLoading}
							<div class="flex items-center gap-2">
								<span class="animate-pulse">...</span>
								<span>{message.content}</span>
							</div>
						{:else}
							<div class="whitespace-pre-wrap break-words chat-content">
								{@html formatMarkdown(message.content)}
							</div>
						{/if}
					</div>
					<span class="text-[10px] text-text-tertiary px-1">
						{formatTime(message.timestamp)}
					</span>
				</div>
			{/each}
		{/if}

		{#if processing}
			<div class="flex items-center gap-2 text-text-tertiary text-sm">
				<span class="animate-pulse">...</span>
				<span>Processing</span>
			</div>
		{/if}
	</div>

	<!-- Input -->
	<form onsubmit={handleSubmit} class="p-3 border-t border-surface-border">
		<div class="relative">
			<input
				type="text"
				bind:value={inputValue}
				onkeydown={handleKeyDown}
				placeholder={processing ? 'Processing...' : 'Type /help for commands...'}
				disabled={processing}
				class="w-full px-3 py-2 pr-16 bg-surface border border-surface-border text-text-primary text-sm font-mono placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary disabled:opacity-50"
			/>
			<button
				type="submit"
				disabled={processing || !inputValue.trim()}
				class="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-mono text-accent-primary border border-accent-primary hover:bg-accent-primary hover:text-bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Send
			</button>
		</div>
	</form>
</div>

<script module lang="ts">
	import DOMPurify from 'dompurify';

	// Allowed HTML tags and attributes for sanitization
	const SANITIZE_CONFIG = {
		ALLOWED_TAGS: ['pre', 'code', 'strong', 'h2', 'h3', 'div', 'br'],
		ALLOWED_ATTR: ['class']
	};

	// Simple markdown formatter for chat messages with XSS protection
	function formatMarkdown(text: string): string {
		const formatted = text
			// Code blocks
			.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-bg-primary p-2 my-1 overflow-x-auto text-xs"><code>$2</code></pre>')
			// Inline code
			.replace(/`([^`]+)`/g, '<code class="bg-bg-primary px-1 text-accent-primary">$1</code>')
			// Bold
			.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-text-primary">$1</strong>')
			// Headers
			.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-text-primary mt-2">$1</h3>')
			.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-text-primary mt-2">$1</h2>')
			// Lists
			.replace(/^- (.+)$/gm, '<div class="pl-2">• $1</div>')
			// Line breaks
			.replace(/\n/g, '<br/>');

		// SECURITY: Sanitize to prevent XSS attacks
		return DOMPurify.sanitize(formatted, SANITIZE_CONFIG);
	}
</script>

<style>
	.chat-content :global(pre) {
		margin: 0.25rem 0;
	}
	.chat-content :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}
</style>
