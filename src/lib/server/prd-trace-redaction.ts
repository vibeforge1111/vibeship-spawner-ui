import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TRACE_PATH_PATTERN = /(?:\/Users\/[^\s"',)]+|\/var\/folders\/[^\s"',)]+|file:\/\/[^\s"',)]+|[A-Za-z]:[\\/][^\s"',)]+)/g;

export interface PrdTraceRedactionRepairResult {
	ok: boolean;
	path: string;
	backupPath: string | null;
	rowsRead: number;
	rowsWritten: number;
	parseErrors: number;
	error?: 'trace_log_missing';
}

function redactedTracePathRef(value: string): string {
	return `path:sha256:${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
}

export function sanitizePrdTraceValue(value: unknown): unknown {
	if (typeof value === 'string') {
		return value.replace(TRACE_PATH_PATTERN, (match) => redactedTracePathRef(match));
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizePrdTraceValue(item));
	}
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, sanitizePrdTraceValue(child)])
		);
	}
	return value;
}

export function sanitizePrdTraceDetails(details: Record<string, unknown>): Record<string, unknown> {
	return sanitizePrdTraceValue(details) as Record<string, unknown>;
}

export async function redactPrdAutoTraceLog(
	traceFilePath: string,
	options: { backup?: boolean } = {}
): Promise<PrdTraceRedactionRepairResult> {
	const backup = options.backup ?? true;
	const result: PrdTraceRedactionRepairResult = {
		ok: true,
		path: traceFilePath,
		backupPath: null,
		rowsRead: 0,
		rowsWritten: 0,
		parseErrors: 0
	};
	let original = '';
	try {
		original = await readFile(traceFilePath, 'utf-8');
	} catch {
		return {
			...result,
			ok: false,
			error: 'trace_log_missing'
		};
	}

	const redactedLines: string[] = [];
	for (const line of original.split(/\r?\n/)) {
		if (!line.trim()) continue;
		result.rowsRead += 1;
		try {
			redactedLines.push(JSON.stringify(sanitizePrdTraceValue(JSON.parse(line))));
		} catch {
			result.parseErrors += 1;
		}
	}

	if (backup) {
		const backupPath = `${traceFilePath}.raw-backup`;
		await writeFile(backupPath, original, 'utf-8');
		result.backupPath = backupPath;
	}
	await writeFile(traceFilePath, redactedLines.length ? `${redactedLines.join('\n')}\n` : '', 'utf-8');
	result.rowsWritten = redactedLines.length;
	result.ok = result.parseErrors === 0;
	return {
		...result,
		path: path.resolve(traceFilePath),
		backupPath: result.backupPath ? path.resolve(result.backupPath) : null
	};
}
