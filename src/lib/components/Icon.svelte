<script lang="ts">
	let { name, size = 20 }: { name: string; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	{#if name === 'book'}
		<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
		<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
	{:else if name === 'layers'}
		<polygon points="12 2 2 7 12 12 22 7 12 2" />
		<polyline points="2 17 12 22 22 17" />
		<polyline points="2 12 12 17 22 12" />
	{:else if name === 'chevron-down'}
		<polyline points="6 9 12 15 18 9" />
	{:else if name === 'grid'}
		<rect x="3" y="3" width="7" height="7" />
		<rect x="14" y="3" width="7" height="7" />
		<rect x="14" y="14" width="7" height="7" />
		<rect x="3" y="14" width="7" height="7" />
	{:else if name === 'compass'}
		<circle cx="12" cy="12" r="10" />
		<polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
	{:else if name === 'plus'}
		<line x1="12" y1="5" x2="12" y2="19" />
		<line x1="5" y1="12" x2="19" y2="12" />
	{:else if name === 'sun'}
		<circle cx="12" cy="12" r="5" />
		<line x1="12" y1="1" x2="12" y2="3" />
		<line x1="12" y1="21" x2="12" y2="23" />
		<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
		<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
		<line x1="1" y1="12" x2="3" y2="12" />
		<line x1="21" y1="12" x2="23" y2="12" />
		<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
		<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
	{:else if name === 'moon'}
		<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
	{:else if name === 'github'}
		<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
	{:else if name === 'arrow-right'}
		<line x1="5" y1="12" x2="19" y2="12" />
		<polyline points="12 5 19 12 12 19" />
	{:else if name === 'x'}
		<line x1="18" y1="6" x2="6" y2="18" />
		<line x1="6" y1="6" x2="18" y2="18" />
	{:else if name === 'menu'}
		<line x1="3" y1="12" x2="21" y2="12" />
		<line x1="3" y1="6" x2="21" y2="6" />
		<line x1="3" y1="18" x2="21" y2="18" />
	{:else if name === 'zap'}
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
	{:else if name === 'check'}
		<polyline points="20 6 9 17 4 12" />
	{:else if name === 'play'}
		<polygon points="5 3 19 12 5 21 5 3" />
	{:else if name === 'scan'}
		<path d="M3 7V5a2 2 0 0 1 2-2h2" />
		<path d="M17 3h2a2 2 0 0 1 2 2v2" />
		<path d="M21 17v2a2 2 0 0 1-2 2h-2" />
		<path d="M7 21H5a2 2 0 0 1-2-2v-2" />
	{:else if name === 'sparkles'}
		<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
		<path d="M5 3v4" />
		<path d="M19 17v4" />
		<path d="M3 5h4" />
		<path d="M17 19h4" />
	{:else if name === 'brain'}
		<path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2z" />
		<path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2z" />
	{:else if name === 'shield'}
		<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
	{:else if name === 'book-open'}
		<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
		<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
	{:else if name === 'external-link'}
		<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
		<polyline points="15 3 21 3 21 9" />
		<line x1="10" y1="14" x2="21" y2="3" />
	{/if}
</svg>
