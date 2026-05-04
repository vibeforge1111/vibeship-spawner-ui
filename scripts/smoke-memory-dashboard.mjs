#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process';

const requested = process.argv.slice(2);
const shouldRun = requested.length === 0 || requested.some((arg) => arg.includes('memory-dashboard'));
if (!shouldRun) {
	console.log('No memory-dashboard smoke target requested.');
	process.exit(0);
}

const port = Number(process.env.MEMORY_DASHBOARD_SMOKE_PORT || 5561);
const baseUrl = `http://127.0.0.1:${port}`;
const childEnv = Object.fromEntries(
	Object.entries(process.env).filter((entry) => typeof entry[1] === 'string')
);
const server = spawn(
	process.platform === 'win32' ? 'cmd.exe' : 'npm',
	process.platform === 'win32'
		? ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${port}`]
		: ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
	{ stdio: ['ignore', 'pipe', 'pipe'], env: { ...childEnv, NODE_ENV: 'development' } }
);

let output = '';
server.stdout.on('data', (chunk) => {
	output += chunk.toString();
});
server.stderr.on('data', (chunk) => {
	output += chunk.toString();
});

try {
	await waitForRoute(`${baseUrl}/memory-dashboard`);
	const html = await fetchText(`${baseUrl}/memory-dashboard`);
	assertIncludes(html, 'Memory health and review queue');
	assertIncludes(html, 'Sample data');
	assertIncludes(html, 'Memory volume');
	assertIncludes(html, 'Retrieval usefulness');
	assertIncludes(html, 'Stale or risky memories');
	assertIncludes(html, 'Dashboard filters');
	assertIncludes(html, 'Actionable memory insights');

	const allTimeHtml = await fetchText(`${baseUrl}/memory-dashboard?smoke=all-time`);
	assertIncludes(allTimeHtml, 'Memory Dashboard v1');
	console.log('PASS /memory-dashboard smoke route, metrics, filters, insight list, and sample-data marker');
} finally {
	stopServer(server);
}

async function waitForRoute(url) {
	const started = Date.now();
	let lastError = null;
	while (Date.now() - started < 30_000) {
		try {
			const response = await fetch(url);
			if (response.ok) return;
			lastError = new Error(`${url} returned ${response.status}`);
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw new Error(`Timed out waiting for ${url}: ${lastError?.message || output}`);
}

async function fetchText(url) {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${url} returned ${response.status}`);
	return response.text();
}

function assertIncludes(text, expected) {
	if (!text.includes(expected)) {
		throw new Error(`Expected dashboard HTML to include "${expected}"`);
	}
}

function stopServer(child) {
	if (child.exitCode !== null) return;
	if (process.platform === 'win32') {
		execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
		return;
	}
	child.kill('SIGTERM');
}
