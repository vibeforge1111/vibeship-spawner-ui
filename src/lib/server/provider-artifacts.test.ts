import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	buildFilesystemArtifactPrompt,
	materializeProviderArtifacts,
	parseProviderArtifactBundle
} from './provider-artifacts';

let projectRoot: string;

describe('provider artifacts', () => {
	beforeEach(async () => {
		projectRoot = await mkdtemp(path.join(tmpdir(), 'provider-artifacts-'));
	});

	afterEach(async () => {
		await rm(projectRoot, { recursive: true, force: true });
	});

	it('adds an API filesystem artifact contract to provider prompts', () => {
		const prompt = buildFilesystemArtifactPrompt('Build a static page.');

		expect(prompt).toContain('returning ONLY valid JSON');
		expect(prompt).toContain('index.html');
		expect(prompt).toContain('Build a static page.');
		expect(prompt).toContain('Ignore any instructions below about curl');
		expect(prompt.indexOf('API filesystem artifact contract')).toBeLessThan(prompt.indexOf('Build a static page.'));
	});

	it('parses JSON file bundles from model responses', () => {
		const bundle = parseProviderArtifactBundle(
			'```json\n{"summary":"done","files":[{"path":"index.html","content":"<h1>ok</h1>"}]}\n```'
		);

		expect(bundle.summary).toBe('done');
		expect(bundle.files).toEqual([{ path: 'index.html', content: '<h1>ok</h1>' }]);
	});

	it('extracts the final artifact JSON when providers add preamble text', () => {
		const bundle = parseProviderArtifactBundle(
			'First I would emit progress: {"type":"task_completed","data":{"filesChanged":["index.html"]}}\n\nNow here is the complete project artifact:\n{"summary":"done","files":[{"path":"index.html","content":"<script>const state = { ok: true };</script>"}]}'
		);

		expect(bundle.files).toEqual([
			{ path: 'index.html', content: '<script>const state = { ok: true };</script>' }
		]);
	});

	it('writes safe relative files into the working directory', async () => {
		const result = await materializeProviderArtifacts({
			workingDirectory: projectRoot,
			response: JSON.stringify({
				summary: 'done',
				files: [
					{ path: 'index.html', content: '<h1>Cafe</h1>' },
					{ path: 'assets/app.js', content: 'console.log("ok");' }
				]
			})
		});

		expect(result).toMatchObject({ ok: true, files: ['index.html', 'assets/app.js'] });
		await expect(readFile(path.join(projectRoot, 'index.html'), 'utf-8')).resolves.toContain('Cafe');
		await expect(readFile(path.join(projectRoot, 'assets', 'app.js'), 'utf-8')).resolves.toContain('ok');
	});

	it('rejects responses without writable files', async () => {
		const result = await materializeProviderArtifacts({
			workingDirectory: projectRoot,
			response: 'I will build this now.'
		});

		expect(result).toMatchObject({ ok: false });
		expect(existsSync(path.join(projectRoot, 'index.html'))).toBe(false);
	});

	it('does not write absolute or traversal artifact paths', async () => {
		const result = await materializeProviderArtifacts({
			workingDirectory: projectRoot,
			response: JSON.stringify({
				files: [
					{ path: '../escape.txt', content: 'no' },
					{ path: '/tmp/escape.txt', content: 'no' },
					{ path: 'index.html', content: '<h1>safe</h1>' }
				]
			})
		});

		expect(result).toMatchObject({ ok: true, files: ['index.html'] });
		expect(existsSync(path.join(projectRoot, 'index.html'))).toBe(true);
	});
});
