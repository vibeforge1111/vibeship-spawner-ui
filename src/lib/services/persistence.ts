/**
 * Persistence Service
 *
 * Centralized localStorage management with:
 * - Data versioning for schema migrations
 * - Error recovery for corrupted data
 * - Automatic backups before destructive operations
 * - Storage quota monitoring
 */

import { browser } from '$app/environment';
import type { Mission } from '$lib/types/mission';

// Current schema version - increment when data structure changes
const SCHEMA_VERSION = 1;
const VERSION_KEY = 'spawner-schema-version';

// All spawner localStorage keys
export const STORAGE_KEYS = {
	VERSION: VERSION_KEY,
	PIPELINES: 'spawner-pipelines',
	CURRENT_PIPELINE: 'spawner-current-pipeline',
	GENERATED_SKILLS: 'spawner-generated-skills',
	MEMORY_SETTINGS: 'spawner-memory-settings',
	MCP_URL: 'mcp-url',
	// Mission execution state
	ACTIVE_MISSION: 'spawner-active-mission',
	MISSION_HISTORY: 'spawner-mission-history',
} as const;

export interface StorageStats {
	totalSize: number;
	totalSizeFormatted: string;
	itemCount: number;
	items: { key: string; size: number; sizeFormatted: string }[];
	quotaUsed: number; // percentage
}

// ============================================
// Core Functions
// ============================================

/**
 * Safely get item from localStorage with JSON parsing
 */
export function getItem<T>(key: string, defaultValue: T): T {
	if (!browser) return defaultValue;

	try {
		const item = localStorage.getItem(key);
		if (item === null) return defaultValue;

		const parsed = JSON.parse(item);
		return parsed as T;
	} catch (e) {
		console.error(`[Persistence] Failed to parse ${key}:`, e);
		// Return default but don't delete - let user decide
		return defaultValue;
	}
}

/**
 * Safely set item in localStorage with JSON stringification
 */
export function setItem<T>(key: string, value: T): boolean {
	if (!browser) return false;

	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (e) {
		if (e instanceof DOMException && e.name === 'QuotaExceededError') {
			console.error('[Persistence] Storage quota exceeded');
			// Could trigger cleanup of old data here
		} else {
			console.error(`[Persistence] Failed to save ${key}:`, e);
		}
		return false;
	}
}

/**
 * Remove item from localStorage
 */
export function removeItem(key: string): boolean {
	if (!browser) return false;

	try {
		localStorage.removeItem(key);
		return true;
	} catch (e) {
		console.error(`[Persistence] Failed to remove ${key}:`, e);
		return false;
	}
}

// ============================================
// Schema Versioning & Migration
// ============================================

/**
 * Get current schema version from storage
 */
export function getStoredVersion(): number {
	if (!browser) return SCHEMA_VERSION;

	const stored = localStorage.getItem(VERSION_KEY);
	if (!stored) return 0; // No version = first run or legacy data

	const version = parseInt(stored, 10);
	return isNaN(version) ? 0 : version;
}

/**
 * Set schema version
 */
export function setStoredVersion(version: number): void {
	if (!browser) return;
	localStorage.setItem(VERSION_KEY, version.toString());
}

/**
 * Run migrations if schema version changed
 */
export function runMigrations(): { migrated: boolean; fromVersion: number; toVersion: number } {
	if (!browser) return { migrated: false, fromVersion: SCHEMA_VERSION, toVersion: SCHEMA_VERSION };

	const storedVersion = getStoredVersion();

	if (storedVersion >= SCHEMA_VERSION) {
		return { migrated: false, fromVersion: storedVersion, toVersion: SCHEMA_VERSION };
	}

	console.log(`[Persistence] Migrating from v${storedVersion} to v${SCHEMA_VERSION}`);

	// Run migrations in sequence
	let currentVersion = storedVersion;

	// Migration 0 -> 1: Initial schema (no changes needed for fresh installs)
	if (currentVersion < 1) {
		// No migration needed for v1 - it's the initial version
		// Future migrations would go here:
		// migrateTo1();
		currentVersion = 1;
	}

	// Future migrations:
	// if (currentVersion < 2) {
	//   migrateTo2();
	//   currentVersion = 2;
	// }

	setStoredVersion(SCHEMA_VERSION);

	return { migrated: currentVersion !== storedVersion, fromVersion: storedVersion, toVersion: SCHEMA_VERSION };
}

// ============================================
// Storage Stats & Monitoring
// ============================================

/**
 * Get detailed storage statistics
 */
export function getStorageStats(): StorageStats {
	if (!browser) {
		return {
			totalSize: 0,
			totalSizeFormatted: '0 B',
			itemCount: 0,
			items: [],
			quotaUsed: 0
		};
	}

	const items: { key: string; size: number; sizeFormatted: string }[] = [];
	let totalSize = 0;

	for (const key of Object.keys(localStorage)) {
		if (key.startsWith('spawner-') || key === 'mcp-url') {
			const value = localStorage.getItem(key) || '';
			const size = (key.length + value.length) * 2; // UTF-16
			totalSize += size;
			items.push({
				key,
				size,
				sizeFormatted: formatBytes(size)
			});
		}
	}

	// Sort by size descending
	items.sort((a, b) => b.size - a.size);

	// Estimate quota (5MB is typical)
	const estimatedQuota = 5 * 1024 * 1024;
	const quotaUsed = (totalSize / estimatedQuota) * 100;

	return {
		totalSize,
		totalSizeFormatted: formatBytes(totalSize),
		itemCount: items.length,
		items,
		quotaUsed: Math.min(100, quotaUsed)
	};
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================
// Backup & Recovery
// ============================================

/**
 * Create a backup of all spawner data
 */
export function createBackup(): string | null {
	if (!browser) return null;

	const backup: Record<string, unknown> = {
		_version: SCHEMA_VERSION,
		_timestamp: new Date().toISOString(),
	};

	for (const key of Object.keys(localStorage)) {
		if (key.startsWith('spawner-') || key === 'mcp-url') {
			try {
				const value = localStorage.getItem(key);
				if (value) {
					backup[key] = JSON.parse(value);
				}
			} catch {
				// Store as string if not JSON
				backup[key] = localStorage.getItem(key);
			}
		}
	}

	return JSON.stringify(backup, null, 2);
}

/**
 * Restore from a backup
 */
export function restoreBackup(backupJson: string): { success: boolean; error?: string; itemsRestored: number } {
	if (!browser) {
		return { success: false, error: 'Not in browser', itemsRestored: 0 };
	}

	try {
		const backup = JSON.parse(backupJson);
		let itemsRestored = 0;

		for (const [key, value] of Object.entries(backup)) {
			if (key.startsWith('_')) continue; // Skip metadata

			if (key.startsWith('spawner-') || key === 'mcp-url') {
				localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
				itemsRestored++;
			}
		}

		return { success: true, itemsRestored };
	} catch (e) {
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Invalid backup format',
			itemsRestored: 0
		};
	}
}

/**
 * Export backup as downloadable file
 */
export function downloadBackup(): void {
	if (!browser) return;

	const backup = createBackup();
	if (!backup) return;

	const blob = new Blob([backup], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `spawner-backup-${new Date().toISOString().slice(0, 10)}.json`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

// ============================================
// Mission State Persistence
// ============================================

// Define types locally to avoid circular dependency with mission-executor
type ExecutionStatus = 'idle' | 'creating' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

interface TaskProgress {
	taskId: string;
	taskName: string;
	progress: number;
	message?: string;
	startedAt: number;
}

/**
 * Serializable version of ExecutionProgress
 * (Map is not JSON-serializable, so we convert it)
 */
export interface PersistedMissionState {
	status: ExecutionStatus;
	missionId: string | null;
	mission: Mission | null;
	executionPrompt: string | null;
	progress: number;
	currentTaskId: string | null;
	currentTaskName: string | null;
	currentTaskProgress: number;
	currentTaskMessage: string | null;
	taskProgressMap: Record<string, TaskProgress>;  // Object instead of Map
	logs: Array<{
		id: string;
		mission_id: string;
		agent_id: string | null;
		task_id: string | null;
		type: string;
		message: string;
		data: Record<string, unknown>;
		created_at: string;
	}>;
	startTime: string | null;  // ISO string instead of Date
	endTime: string | null;
	error: string | null;
	// Metadata for recovery
	savedAt: string;
	version: number;
}

/**
 * Mission history entry for showing recent missions
 */
export interface MissionHistoryEntry {
	id: string;
	name: string;
	status: ExecutionStatus;
	progress: number;
	startTime: string;
	endTime: string | null;
	taskCount: number;
	completedTasks: number;
}

const MISSION_STATE_VERSION = 1;
const MAX_HISTORY_ENTRIES = 10;

/**
 * Save active mission state to localStorage
 */
export function saveMissionState(state: PersistedMissionState): boolean {
	return setItem(STORAGE_KEYS.ACTIVE_MISSION, {
		...state,
		savedAt: new Date().toISOString(),
		version: MISSION_STATE_VERSION
	});
}

/**
 * Get active mission state from localStorage
 */
export function getActiveMissionState(): PersistedMissionState | null {
	const state = getItem<PersistedMissionState | null>(STORAGE_KEYS.ACTIVE_MISSION, null);

	if (!state) return null;

	// Validate version
	if (state.version !== MISSION_STATE_VERSION) {
		console.log('[Persistence] Mission state version mismatch, clearing');
		clearMissionState();
		return null;
	}

	// Check if mission is still active (not completed/failed/cancelled)
	if (state.status === 'completed' || state.status === 'failed' || state.status === 'cancelled') {
		// Move to history and clear active
		addToMissionHistory(state);
		clearMissionState();
		return null;
	}

	return state;
}

/**
 * Clear active mission state
 */
export function clearMissionState(): boolean {
	return removeItem(STORAGE_KEYS.ACTIVE_MISSION);
}

/**
 * Add completed mission to history
 */
export function addToMissionHistory(state: PersistedMissionState): boolean {
	if (!state.mission) return false;

	const history = getMissionHistory();

	const entry: MissionHistoryEntry = {
		id: state.missionId || state.mission.id,
		name: state.mission.name,
		status: state.status,
		progress: state.progress,
		startTime: state.startTime || new Date().toISOString(),
		endTime: state.endTime,
		taskCount: state.mission.tasks?.length || 0,
		completedTasks: state.mission.tasks?.filter(t => t.status === 'completed').length || 0
	};

	// Add to front, limit history size
	const newHistory = [entry, ...history.filter(h => h.id !== entry.id)].slice(0, MAX_HISTORY_ENTRIES);

	return setItem(STORAGE_KEYS.MISSION_HISTORY, newHistory);
}

/**
 * Get mission history
 */
export function getMissionHistory(): MissionHistoryEntry[] {
	return getItem<MissionHistoryEntry[]>(STORAGE_KEYS.MISSION_HISTORY, []);
}

/**
 * Clear mission history
 */
export function clearMissionHistory(): boolean {
	return removeItem(STORAGE_KEYS.MISSION_HISTORY);
}

/**
 * Check if there's a resumable mission
 */
export function hasResumableMission(): boolean {
	const state = getItem<PersistedMissionState | null>(STORAGE_KEYS.ACTIVE_MISSION, null);
	if (!state) return false;

	// Only resumable if paused or running (interrupted)
	return state.status === 'paused' || state.status === 'running' || state.status === 'creating';
}

// ============================================
// Data Validation
// ============================================

/**
 * Validate pipeline data structure
 */
export function validatePipelineData(data: unknown): boolean {
	if (!Array.isArray(data)) return false;

	for (const pipeline of data) {
		if (typeof pipeline !== 'object' || pipeline === null) return false;
		if (typeof pipeline.id !== 'string') return false;
		if (typeof pipeline.name !== 'string') return false;
	}

	return true;
}

/**
 * Validate generated skills data structure
 */
export function validateGeneratedSkillsData(data: unknown): boolean {
	if (!Array.isArray(data)) return false;

	for (const skill of data) {
		if (typeof skill !== 'object' || skill === null) return false;
		if (typeof skill.id !== 'string') return false;
		if (!skill.id.startsWith('generated-')) return false;
		if (typeof skill.name !== 'string') return false;
	}

	return true;
}

// ============================================
// Initialization
// ============================================

/**
 * Initialize persistence system
 * Call this on app startup
 */
export function initPersistence(): {
	migrated: boolean;
	fromVersion: number;
	toVersion: number;
	stats: StorageStats;
} {
	if (!browser) {
		return {
			migrated: false,
			fromVersion: SCHEMA_VERSION,
			toVersion: SCHEMA_VERSION,
			stats: {
				totalSize: 0,
				totalSizeFormatted: '0 B',
				itemCount: 0,
				items: [],
				quotaUsed: 0
			}
		};
	}

	// Run any pending migrations
	const migration = runMigrations();

	// Get current stats
	const stats = getStorageStats();

	// Log initialization
	console.log(`[Persistence] Initialized (v${SCHEMA_VERSION}), using ${stats.totalSizeFormatted}`);

	if (migration.migrated) {
		console.log(`[Persistence] Migrated from v${migration.fromVersion} to v${migration.toVersion}`);
	}

	return {
		...migration,
		stats
	};
}
