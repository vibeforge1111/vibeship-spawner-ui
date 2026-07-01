import os from 'node:os';
import path from 'node:path';
import { redactPrdAutoTraceLog } from '../src/lib/server/prd-trace-redaction';

function argValue(args: string[], name: string): string | null {
	const index = args.indexOf(`--${name}`);
	return index === -1 ? null : args[index + 1] || null;
}

function hasFlag(args: string[], name: string): boolean {
	return args.includes(`--${name}`);
}

function defaultStateDir(): string {
	const explicit = process.env.SPAWNER_STATE_DIR?.trim();
	if (explicit) return explicit;
	const sparkHome = process.env.SPARK_HOME?.trim() || path.join(os.homedir(), '.spark');
	return path.join(sparkHome, 'state', 'spawner-ui');
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const tracePath = path.resolve(
		argValue(args, 'trace') || path.join(argValue(args, 'state-dir') || defaultStateDir(), 'prd-auto-trace.jsonl')
	);
	const result = await redactPrdAutoTraceLog(tracePath, { backup: !hasFlag(args, 'no-backup') });
	if (hasFlag(args, 'json')) {
		console.log(JSON.stringify(result, null, 2));
	} else if (result.ok) {
		console.log(
			`Redacted ${result.rowsWritten} PRD trace row(s).${result.backupPath ? ` Backup: ${result.backupPath}` : ''}`
		);
	} else {
		console.log(JSON.stringify(result, null, 2));
	}
	process.exitCode = result.ok || result.error === 'trace_log_missing' ? 0 : 1;
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
