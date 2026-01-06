/**
 * Pre-Mission Context Service
 *
 * Fetches relevant learnings before mission execution to provide:
 * - Suggested patterns from similar past missions
 * - Warnings from past failures
 * - Relevant tips and learnings
 */

import { memoryClient } from './memory-client';
import { findSimilarSituations, getFailureWarnings, getSkillSuggestions } from './learning-query';
import type { Memory } from '$lib/types/memory';
import type { CanvasNode } from '$lib/stores/canvas.svelte';

// ============================================
// Types
// ============================================

export interface PreMissionContext {
	/** Workflow patterns that worked for similar goals */
	suggestedPatterns: PatternSuggestion[];
	/** Warnings from past failures */
	warnings: WarningSuggestion[];
	/** General tips from past experience */
	tips: TipSuggestion[];
	/** One-line summary */
	summary: string;
	/** Whether any context was found */
	hasContext: boolean;
	/** Loading state */
	loading: boolean;
	/** Error message if fetch failed */
	error: string | null;
}

export interface PatternSuggestion {
	id: string;
	content: string;
	skillSequence: string[];
	successRate: number;
	confidence: number;
	memory: Memory;
}

export interface WarningSuggestion {
	id: string;
	content: string;
	severity: 'info' | 'warning' | 'critical';
	skillId?: string;
	memory: Memory;
}

export interface TipSuggestion {
	id: string;
	content: string;
	source: string;
	confidence: number;
	memory: Memory;
}

// ============================================
// Context Fetching
// ============================================

/**
 * Get pre-mission context for a workflow
 */
export async function getPreMissionContext(
	goalDescription: string,
	nodes: CanvasNode[]
): Promise<PreMissionContext> {
	const skillIds = nodes.map(n => n.skill.id);
	const skillNames = nodes.map(n => n.skill.name).join(', ');

	const emptyContext: PreMissionContext = {
		suggestedPatterns: [],
		warnings: [],
		tips: [],
		summary: '',
		hasContext: false,
		loading: false,
		error: null
	};

	try {
		// Fetch in parallel
		const [patterns, warnings, skillTips] = await Promise.all([
			fetchSuggestedPatterns(goalDescription, skillIds),
			fetchWarnings(goalDescription, skillIds),
			fetchSkillTips(skillIds)
		]);

		const hasContext = patterns.length > 0 || warnings.length > 0 || skillTips.length > 0;

		// Generate summary
		let summary = '';
		if (hasContext) {
			const parts: string[] = [];
			if (patterns.length > 0) {
				parts.push(`${patterns.length} pattern${patterns.length > 1 ? 's' : ''} found`);
			}
			if (warnings.length > 0) {
				parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
			}
			if (skillTips.length > 0) {
				parts.push(`${skillTips.length} tip${skillTips.length > 1 ? 's' : ''}`);
			}
			summary = `Mind found ${parts.join(', ')} for this workflow`;
		} else {
			summary = 'No past learnings found for this workflow';
		}

		return {
			suggestedPatterns: patterns,
			warnings,
			tips: skillTips,
			summary,
			hasContext,
			loading: false,
			error: null
		};
	} catch (error) {
		console.error('[PreMissionContext] Failed to fetch context:', error);
		return {
			...emptyContext,
			error: error instanceof Error ? error.message : 'Failed to fetch context'
		};
	}
}

/**
 * Fetch suggested workflow patterns
 */
async function fetchSuggestedPatterns(
	goalDescription: string,
	skillIds: string[]
): Promise<PatternSuggestion[]> {
	try {
		const result = await memoryClient.getWorkflowPatterns(goalDescription, 5);

		if (!result.success || !result.data) {
			return [];
		}

		return result.data
			.filter(m => m.effective_salience > 0.3)
			.map(memory => {
				const meta = memory.metadata as {
					workflow_sequence?: string[];
					success_count?: number;
					failure_count?: number;
					confidence?: number;
				};

				const successCount = meta?.success_count || 0;
				const failureCount = meta?.failure_count || 0;
				const total = successCount + failureCount;
				const successRate = total > 0 ? successCount / total : 0.5;

				return {
					id: memory.memory_id,
					content: memory.content,
					skillSequence: meta?.workflow_sequence || [],
					successRate,
					confidence: meta?.confidence || memory.effective_salience,
					memory
				};
			})
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, 3);
	} catch (error) {
		console.error('[PreMissionContext] Failed to fetch patterns:', error);
		return [];
	}
}

/**
 * Fetch failure warnings
 */
async function fetchWarnings(
	goalDescription: string,
	skillIds: string[]
): Promise<WarningSuggestion[]> {
	try {
		const failures = await getFailureWarnings(goalDescription);

		return failures
			.slice(0, 5)
			.map(memory => {
				const meta = memory.metadata as {
					skill_id?: string;
					confidence?: number;
				};

				// Determine severity based on salience/confidence
				const confidence = meta?.confidence || memory.effective_salience;
				let severity: 'info' | 'warning' | 'critical' = 'info';
				if (confidence > 0.7) severity = 'critical';
				else if (confidence > 0.4) severity = 'warning';

				return {
					id: memory.memory_id,
					content: memory.content,
					severity,
					skillId: meta?.skill_id,
					memory
				};
			});
	} catch (error) {
		console.error('[PreMissionContext] Failed to fetch warnings:', error);
		return [];
	}
}

/**
 * Fetch tips for specific skills
 */
async function fetchSkillTips(skillIds: string[]): Promise<TipSuggestion[]> {
	try {
		const tips: TipSuggestion[] = [];

		// Limit to first 3 skills to avoid too many requests
		for (const skillId of skillIds.slice(0, 3)) {
			const suggestions = await getSkillSuggestions(skillId);

			for (const memory of suggestions.slice(0, 2)) {
				const meta = memory.metadata as {
					pattern_type?: string;
					confidence?: number;
				};

				// Only include success learnings as tips
				if (meta?.pattern_type !== 'success') continue;

				tips.push({
					id: memory.memory_id,
					content: memory.content,
					source: skillId,
					confidence: meta?.confidence || memory.effective_salience,
					memory
				});
			}
		}

		return tips
			.sort((a, b) => b.confidence - a.confidence)
			.slice(0, 5);
	} catch (error) {
		console.error('[PreMissionContext] Failed to fetch skill tips:', error);
		return [];
	}
}

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format pattern for display
 */
export function formatPattern(pattern: PatternSuggestion): string {
	const successPct = Math.round(pattern.successRate * 100);
	const sequence = pattern.skillSequence.slice(0, 3).join(' → ');
	return `${pattern.content.slice(0, 80)}${pattern.content.length > 80 ? '...' : ''} (${successPct}% success${sequence ? `, ${sequence}` : ''})`;
}

/**
 * Format warning for display
 */
export function formatWarning(warning: WarningSuggestion): string {
	return warning.content.slice(0, 120) + (warning.content.length > 120 ? '...' : '');
}

/**
 * Format tip for display
 */
export function formatTip(tip: TipSuggestion): string {
	return `${tip.content.slice(0, 100)}${tip.content.length > 100 ? '...' : ''} (from ${tip.source})`;
}

/**
 * Get severity icon
 */
export function getSeverityIcon(severity: WarningSuggestion['severity']): string {
	switch (severity) {
		case 'critical': return '🚨';
		case 'warning': return '⚠️';
		case 'info': return 'ℹ️';
	}
}

/**
 * Get severity color class
 */
export function getSeverityColor(severity: WarningSuggestion['severity']): string {
	switch (severity) {
		case 'critical': return 'border-red-500/50 bg-red-500/10 text-red-400';
		case 'warning': return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400';
		case 'info': return 'border-blue-500/50 bg-blue-500/10 text-blue-400';
	}
}
