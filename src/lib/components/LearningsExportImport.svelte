<script lang="ts">
	import { memoryClient } from '$lib/services/memory-client';
	import type { Memory, ContentType } from '$lib/types/memory';
	import { isMemoryConnected } from '$lib/stores/memory-settings.svelte';
	import { LearningsExportDataSchema, safeJsonParse } from '$lib/types/schemas';

	interface Props {
		onImportComplete?: (count: number) => void;
		onExportComplete?: (count: number) => void;
	}

	let { onImportComplete, onExportComplete }: Props = $props();

	let exporting = $state(false);
	let importing = $state(false);
	let memoryConnected = $state(false);
	let exportFormat = $state<'json' | 'markdown'>('json');
	let includePatterns = $state(true);
	let includeLearnings = $state(true);
	let includeDecisions = $state(true);
	let lastExportCount = $state(0);
	let lastImportCount = $state(0);
	let error = $state<string | null>(null);
	let success = $state<string | null>(null);

	interface ExportData {
		version: string;
		exportedAt: string;
		source: string;
		memories: Memory[];
		stats: {
			totalCount: number;
			byType: Record<string, number>;
		};
	}

	const CONTENT_TYPES: ContentType[] = [
		'fact',
		'preference',
		'event',
		'goal',
		'observation',
		'agent_decision',
		'agent_learning',
		'workflow_pattern',
		'task_outcome',
		'handoff_context',
		'skill_insight',
		'decision_reinforcement',
		'pattern_reinforcement',
		'project_decision',
		'project_issue',
		'session_summary',
		'skill_improvement',
		'agent_improvement',
		'team_improvement',
		'pipeline_improvement'
	];

	function toContentType(value: unknown): ContentType | undefined {
		return typeof value === 'string' && (CONTENT_TYPES as string[]).includes(value)
			? (value as ContentType)
			: undefined;
	}

	function toTemporalLevel(value: unknown): 1 | 2 | 3 | 4 | undefined {
		return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
	}

	function toSalience(value: unknown): number | undefined {
		return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
	}

	$effect(() => {
		const unsub = isMemoryConnected.subscribe((v) => (memoryConnected = v));
		return unsub;
	});

	async function handleExport() {
		if (!memoryConnected) return;

		exporting = true;
		error = null;
		success = null;

		try {
			// Collect content types to export
			const contentTypes: string[] = [];
			if (includeLearnings) contentTypes.push('agent_learning');
			if (includePatterns) contentTypes.push('workflow_pattern');
			if (includeDecisions) contentTypes.push('agent_decision');

			if (contentTypes.length === 0) {
				error = 'Select at least one type to export';
				exporting = false;
				return;
			}

			// Retrieve all memories of selected types
			const allMemories: Memory[] = [];

			for (const contentType of contentTypes) {
				const result = await memoryClient.retrieve(contentType, {
					limit: 1000,
					content_types: [contentType as ContentType]
				});

				if (result.success && result.data) {
					allMemories.push(...result.data.memories.map(sm => sm.memory));
				}
			}

			// Build export data
			const byType: Record<string, number> = {};
			for (const m of allMemories) {
				byType[m.content_type] = (byType[m.content_type] || 0) + 1;
			}

			const exportData: ExportData = {
				version: '1.0',
				exportedAt: new Date().toISOString(),
				source: 'spawner-ui',
				memories: allMemories,
				stats: {
					totalCount: allMemories.length,
					byType
				}
			};

			// Generate file content
			let content: string;
			let filename: string;
			let mimeType: string;

			if (exportFormat === 'json') {
				content = JSON.stringify(exportData, null, 2);
				filename = `learnings-export-${new Date().toISOString().split('T')[0]}.json`;
				mimeType = 'application/json';
			} else {
				// Markdown format
				const lines: string[] = [
					'# Learnings Export',
					'',
					`Exported: ${new Date().toLocaleString()}`,
					`Total memories: ${allMemories.length}`,
					'',
					'---',
					''
				];

				// Group by type
				const grouped = new Map<string, Memory[]>();
				for (const m of allMemories) {
					if (!grouped.has(m.content_type)) {
						grouped.set(m.content_type, []);
					}
					grouped.get(m.content_type)!.push(m);
				}

				for (const [type, memories] of grouped) {
					lines.push(`## ${formatContentType(type)} (${memories.length})`);
					lines.push('');

					for (const m of memories) {
						const meta = m.metadata as {
							agent_id?: string;
							skill_id?: string;
							confidence?: number;
							pattern_type?: string;
						};

						lines.push(`### ${m.content.slice(0, 60)}${m.content.length > 60 ? '...' : ''}`);
						lines.push('');
						lines.push(m.content);
						lines.push('');

						const metaLines: string[] = [];
						if (meta?.agent_id) metaLines.push(`Agent: ${meta.agent_id}`);
						if (meta?.skill_id) metaLines.push(`Skill: ${meta.skill_id}`);
						if (meta?.confidence) metaLines.push(`Confidence: ${Math.round(meta.confidence * 100)}%`);
						if (meta?.pattern_type) metaLines.push(`Type: ${meta.pattern_type}`);

						if (metaLines.length > 0) {
							lines.push(`> ${metaLines.join(' | ')}`);
							lines.push('');
						}

						lines.push('---');
						lines.push('');
					}
				}

				content = lines.join('\n');
				filename = `learnings-export-${new Date().toISOString().split('T')[0]}.md`;
				mimeType = 'text/markdown';
			}

			// Trigger download
			const blob = new Blob([content], { type: mimeType });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			lastExportCount = allMemories.length;
			success = `Exported ${allMemories.length} memories`;
			onExportComplete?.(allMemories.length);
		} catch (err) {
			console.error('Export failed:', err);
			error = err instanceof Error ? err.message : 'Export failed';
		} finally {
			exporting = false;
		}
	}

	async function handleImport(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		importing = true;
		error = null;
		success = null;

		try {
			const text = await file.text();
			let importMemories: Array<{
				content: string;
				content_type?: string;
				temporal_level?: number;
				salience?: number;
				metadata?: unknown;
			}>;

			if (file.name.endsWith('.json')) {
				// SECURITY: Validate JSON with Zod schema
				const parsed = safeJsonParse(text, LearningsExportDataSchema, 'learnings-import');
				if (!parsed) {
					error = 'Invalid import file format';
					importing = false;
					return;
				}
				importMemories = parsed.memories;
			} else {
				error = 'Only JSON format is supported for import';
				importing = false;
				return;
			}

			// Import memories
			let importedCount = 0;
			let skippedCount = 0;

			for (const memory of importMemories) {
				try {
					// Create memory (will skip if already exists based on content)
					const result = await memoryClient.createMemory({
						content: memory.content,
						content_type: toContentType(memory.content_type),
						temporal_level: toTemporalLevel(memory.temporal_level),
						salience: toSalience(memory.salience)
					});

					if (result.success) {
						importedCount++;
					} else {
						skippedCount++;
					}
				} catch {
					skippedCount++;
				}
			}

			lastImportCount = importedCount;
			success = `Imported ${importedCount} memories${skippedCount > 0 ? ` (${skippedCount} skipped)` : ''}`;
			onImportComplete?.(importedCount);
		} catch (err) {
			console.error('Import failed:', err);
			error = err instanceof Error ? err.message : 'Import failed';
		} finally {
			importing = false;
			// Reset file input
			input.value = '';
		}
	}

	function formatContentType(type: string): string {
		return type
			.split('_')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
</script>

{#if memoryConnected}
	<div class="border border-surface-border bg-bg-secondary">
		<div class="p-4 border-b border-surface-border">
			<h3 class="font-medium text-text-primary">Export / Import Learnings</h3>
			<p class="text-xs text-text-tertiary mt-1">Share learnings across projects or back them up</p>
		</div>

		<div class="p-4 space-y-4">
			<!-- Export Section -->
			<div class="space-y-3">
				<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Export</div>

				<!-- Format selection -->
				<div class="flex gap-2">
					<button
						class="flex-1 px-3 py-2 text-xs font-mono border transition-all {exportFormat === 'json'
							? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
							: 'border-surface-border text-text-secondary hover:border-text-tertiary'}"
						onclick={() => exportFormat = 'json'}
					>
						JSON
					</button>
					<button
						class="flex-1 px-3 py-2 text-xs font-mono border transition-all {exportFormat === 'markdown'
							? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
							: 'border-surface-border text-text-secondary hover:border-text-tertiary'}"
						onclick={() => exportFormat = 'markdown'}
					>
						Markdown
					</button>
				</div>

				<!-- Type selection -->
				<div class="space-y-2">
					<label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
						<input type="checkbox" bind:checked={includeLearnings} class="accent-accent-primary" />
						<span>Agent Learnings</span>
					</label>
					<label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
						<input type="checkbox" bind:checked={includePatterns} class="accent-accent-primary" />
						<span>Workflow Patterns</span>
					</label>
					<label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
						<input type="checkbox" bind:checked={includeDecisions} class="accent-accent-primary" />
						<span>Agent Decisions</span>
					</label>
				</div>

				<button
					onclick={handleExport}
					disabled={exporting || (!includeLearnings && !includePatterns && !includeDecisions)}
					class="w-full px-4 py-2 font-mono text-sm bg-accent-primary text-bg-primary hover:bg-accent-primary-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{exporting ? 'Exporting...' : 'Export Learnings'}
				</button>
			</div>

			<!-- Divider -->
			<div class="border-t border-surface-border"></div>

			<!-- Import Section -->
			<div class="space-y-3">
				<div class="text-xs font-mono text-text-tertiary uppercase tracking-wider">Import</div>

				<label class="block">
					<input
						type="file"
						accept=".json"
						onchange={handleImport}
						disabled={importing}
						class="hidden"
					/>
					<div
						class="w-full px-4 py-4 border border-dashed border-surface-border text-center cursor-pointer hover:border-text-tertiary hover:bg-surface/50 transition-all {importing ? 'opacity-50 cursor-not-allowed' : ''}"
					>
						<div class="text-sm text-text-secondary">
							{importing ? 'Importing...' : 'Click to select file'}
						</div>
						<div class="text-xs text-text-tertiary mt-1">
							JSON files only
						</div>
					</div>
				</label>
			</div>

			<!-- Status messages -->
			{#if error}
				<div class="px-3 py-2 text-xs font-mono border border-red-500/30 bg-red-500/10 text-red-400">
					{error}
				</div>
			{/if}

			{#if success}
				<div class="px-3 py-2 text-xs font-mono border border-green-500/30 bg-green-500/10 text-green-400">
					{success}
				</div>
			{/if}

			<!-- Last stats -->
			{#if lastExportCount > 0 || lastImportCount > 0}
				<div class="text-xs text-text-tertiary font-mono">
					{#if lastExportCount > 0}
						<span>Last export: {lastExportCount} memories</span>
					{/if}
					{#if lastExportCount > 0 && lastImportCount > 0}
						<span class="mx-2">|</span>
					{/if}
					{#if lastImportCount > 0}
						<span>Last import: {lastImportCount} memories</span>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{:else}
	<div class="border border-surface-border bg-bg-secondary p-4">
		<p class="text-sm text-text-tertiary text-center">
			Connect to Mind to export/import learnings
		</p>
	</div>
{/if}
