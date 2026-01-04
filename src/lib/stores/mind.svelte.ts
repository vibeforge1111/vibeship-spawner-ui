/**
 * Mind Store - Manages project memory and knowledge
 *
 * Provides state management for:
 * - Project decisions and their rationale
 * - Open/resolved issues
 * - Session summaries
 * - Validated patterns
 */

import { writable, derived, get } from 'svelte/store';
import { mcpClient } from '$lib/services/mcp-client';
import type { MindProject, MindDecision, MindIssue } from '$lib/services/mcp-client';

export interface MindState {
	project: MindProject | null;
	loading: boolean;
	error: string | null;
}

const initialState: MindState = {
	project: null,
	loading: false,
	error: null
};

export const mindState = writable<MindState>(initialState);

// Derived stores for convenience
export const currentProject = derived(mindState, ($state) => $state.project);
export const decisions = derived(mindState, ($state) => $state.project?.decisions ?? []);
export const issues = derived(mindState, ($state) => $state.project?.issues ?? []);
export const openIssues = derived(issues, ($issues) => $issues.filter((i) => i.status === 'open'));
export const resolvedIssues = derived(issues, ($issues) => $issues.filter((i) => i.status === 'resolved'));
export const sessions = derived(mindState, ($state) => $state.project?.sessions ?? []);
export const isLoading = derived(mindState, ($state) => $state.loading);
export const hasError = derived(mindState, ($state) => $state.error !== null);

/**
 * Load a project's memory/context
 */
export async function loadProject(options?: {
	project_id?: string;
	project_description?: string;
	stack_hints?: string[];
}): Promise<boolean> {
	mindState.update((s) => ({ ...s, loading: true, error: null }));

	try {
		const result = await mcpClient.loadProject(options);

		if (result.success && result.data) {
			mindState.update((s) => ({
				...s,
				project: result.data!,
				loading: false
			}));
			return true;
		} else {
			mindState.update((s) => ({
				...s,
				loading: false,
				error: result.error || 'Failed to load project'
			}));
			return false;
		}
	} catch (e) {
		mindState.update((s) => ({
			...s,
			loading: false,
			error: e instanceof Error ? e.message : 'Unknown error'
		}));
		return false;
	}
}

/**
 * Add a decision to the project
 */
export async function addDecision(what: string, why: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				decision: { what, why }
			},
			state.project.project_id
		);

		if (result.success) {
			// Add locally while we wait for refresh
			const newDecision: MindDecision = {
				what,
				why,
				created_at: new Date().toISOString()
			};

			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							decisions: [newDecision, ...s.project.decisions]
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Add an issue to track
 */
export async function addIssue(description: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				issue: { description, status: 'open' }
			},
			state.project.project_id
		);

		if (result.success) {
			const newIssue: MindIssue = {
				description,
				status: 'open',
				created_at: new Date().toISOString()
			};

			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							issues: [newIssue, ...s.project.issues]
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Resolve an issue
 */
export async function resolveIssue(description: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				issue: { description, status: 'resolved' }
			},
			state.project.project_id
		);

		if (result.success) {
			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							issues: s.project.issues.map((i) =>
								i.description === description ? { ...i, status: 'resolved' as const } : i
							)
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Add a session summary
 */
export async function addSessionSummary(summary: string): Promise<boolean> {
	const state = get(mindState);
	if (!state.project) return false;

	try {
		const result = await mcpClient.remember(
			{
				session_summary: summary
			},
			state.project.project_id
		);

		if (result.success) {
			const newSession = {
				summary,
				created_at: new Date().toISOString()
			};

			mindState.update((s) => ({
				...s,
				project: s.project
					? {
							...s.project,
							sessions: [newSession, ...s.project.sessions]
						}
					: null
			}));
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/**
 * Clear mind state
 */
export function clearMindState() {
	mindState.set(initialState);
}
