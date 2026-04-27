#!/usr/bin/env node
/**
 * sync-runtime.cjs — mirror Desktop spawner-ui edits into the live runtime copy.
 *
 * The dev server on :5173 and codex-auto runs from C:/Users/USER/.spark/modules/
 * spawner-ui/source. Edits made in C:/Users/USER/Desktop/spawner-ui must be
 * mirrored there, otherwise codex picks up the old prompt and we ship stale
 * behavior.
 *
 * Usage:
 *   node scripts/sync-runtime.cjs            # one-shot sync
 *   node scripts/sync-runtime.cjs --watch    # chokidar-free poll-watcher
 *   node scripts/sync-runtime.cjs --check    # exit 1 if drift detected
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const RUNTIME_ROOT = path.join(os.homedir(), '.spark', 'modules', 'spawner-ui', 'source');

// Files / dirs that shape canvas generation. Add to this list as the surface grows.
const SYNCED_PATHS = [
	'src/lib/server/skill-tiers.ts',
	'src/lib/server/claude-auto-analysis.ts',
	'src/routes/api/prd-bridge/write/+server.ts',
	'src/routes/api/spark/run/+server.ts',
	'static/bundles'
];

function exists(p) {
	try {
		fs.accessSync(p);
		return true;
	} catch {
		return false;
	}
}

function checksum(p) {
	if (!exists(p)) return null;
	const stat = fs.statSync(p);
	if (stat.isDirectory()) {
		return fs
			.readdirSync(p)
			.sort()
			.map((f) => `${f}:${checksum(path.join(p, f))}`)
			.join('|');
	}
	const bytes = fs.readFileSync(p);
	return `${bytes.length}:${require('crypto').createHash('md5').update(bytes).digest('hex')}`;
}

function copyOne(rel) {
	const src = path.join(SOURCE_ROOT, rel);
	const dst = path.join(RUNTIME_ROOT, rel);
	if (!exists(src)) {
		console.warn(`[sync] missing source: ${rel}`);
		return false;
	}
	const stat = fs.statSync(src);
	if (stat.isDirectory()) {
		fs.mkdirSync(dst, { recursive: true });
		for (const f of fs.readdirSync(src)) copyOne(path.join(rel, f));
		return true;
	}
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	fs.copyFileSync(src, dst);
	return true;
}

function syncOnce({ silent = false } = {}) {
	if (!exists(RUNTIME_ROOT)) {
		console.warn(`[sync] runtime not present at ${RUNTIME_ROOT} — skipping (this looks like a bare Desktop checkout).`);
		return { synced: 0, skipped: SYNCED_PATHS.length };
	}
	let synced = 0;
	for (const rel of SYNCED_PATHS) {
		const src = path.join(SOURCE_ROOT, rel);
		const dst = path.join(RUNTIME_ROOT, rel);
		if (checksum(src) === checksum(dst)) continue;
		if (copyOne(rel)) {
			synced++;
			if (!silent) console.log(`[sync] -> ${rel}`);
		}
	}
	if (!silent) console.log(synced > 0 ? `[sync] ${synced} path(s) updated.` : '[sync] nothing to do.');
	return { synced, skipped: 0 };
}

function checkDrift() {
	if (!exists(RUNTIME_ROOT)) {
		console.error(`[check] runtime not present at ${RUNTIME_ROOT}`);
		process.exit(0);
	}
	const drift = [];
	for (const rel of SYNCED_PATHS) {
		const a = checksum(path.join(SOURCE_ROOT, rel));
		const b = checksum(path.join(RUNTIME_ROOT, rel));
		if (a !== b) drift.push(rel);
	}
	if (drift.length === 0) {
		console.log('[check] runtime in sync.');
		process.exit(0);
	}
	console.error('[check] DRIFT detected:');
	for (const d of drift) console.error(`  - ${d}`);
	console.error('Run `npm run sync:runtime` to fix.');
	process.exit(1);
}

function watch() {
	console.log('[sync] watching every 2s. Ctrl-C to stop.');
	syncOnce();
	setInterval(() => syncOnce({ silent: true }), 2000);
}

const arg = process.argv[2];
if (arg === '--watch') watch();
else if (arg === '--check') checkDrift();
else syncOnce();
