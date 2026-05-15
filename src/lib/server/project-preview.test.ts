import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	ProjectPreviewError,
	assertProjectPreviewHost,
	encodeProjectPreviewToken,
	getProjectPreviewAllowedRoots,
	projectPreviewUrl,
	resolveProjectPreviewAsset,
	resolveProjectPreviewRoot,
	rewriteProjectPreviewHtml
} from './project-preview';

describe('project-preview', () => {
	it('creates stable localhost preview URLs for static project folders', () => {
		const projectPath = resolve('C:/Users/USER/Desktop/spark-demo');
		const url = projectPreviewUrl('http://127.0.0.1:5555/', projectPath);

		expect(url).toMatch(/^http:\/\/127\.0\.0\.1:5555\/preview\/[A-Za-z0-9_-]+\/index\.html$/);
	});

	it('points preview URLs at a nested playable folder when the project root has no index', () => {
		const projectRoot = mkdtempSync(join(tmpdir(), 'spark-preview-nested-'));
		const nestedRoot = join(projectRoot, 'fail', 'restart');
		mkdirSync(nestedRoot, { recursive: true });
		writeFileSync(join(nestedRoot, 'index.html'), '<h1>nested app</h1>');

		const url = projectPreviewUrl('http://127.0.0.1:5555/', projectRoot);
		const token = url.match(/\/preview\/([^/]+)\/index\.html$/)?.[1];

		expect(token).toBeTruthy();
		expect(resolveProjectPreviewAsset({
			token: token!,
			env: { SPARK_PROJECT_PREVIEW_ROOTS: projectRoot }
		}).filePath).toBe(join(nestedRoot, 'index.html'));
	});

	it('keeps the root preview when the project root already has an index', () => {
		const projectRoot = mkdtempSync(join(tmpdir(), 'spark-preview-root-index-'));
		const nestedRoot = join(projectRoot, 'fail', 'restart');
		mkdirSync(nestedRoot, { recursive: true });
		writeFileSync(join(projectRoot, 'index.html'), '<h1>root app</h1>');
		writeFileSync(join(nestedRoot, 'index.html'), '<h1>nested app</h1>');

		const url = projectPreviewUrl('http://127.0.0.1:5555/', projectRoot);
		const token = url.match(/\/preview\/([^/]+)\/index\.html$/)?.[1];

		expect(resolveProjectPreviewAsset({
			token: token!,
			env: { SPARK_PROJECT_PREVIEW_ROOTS: projectRoot }
		}).filePath).toBe(join(projectRoot, 'index.html'));
	});

	it('prefers built Vite dist output over a source index', () => {
		const projectRoot = mkdtempSync(join(tmpdir(), 'spark-preview-vite-dist-'));
		mkdirSync(join(projectRoot, 'dist', 'assets'), { recursive: true });
		writeFileSync(join(projectRoot, 'package.json'), '{"scripts":{"build":"vite build"}}');
		writeFileSync(join(projectRoot, 'index.html'), '<script type="module" src="/src/main.ts"></script>');
		writeFileSync(join(projectRoot, 'dist', 'index.html'), '<script type="module" src="/assets/index.js"></script>');
		writeFileSync(join(projectRoot, 'dist', 'assets', 'index.js'), 'console.log("ok");');

		expect(resolveProjectPreviewRoot(projectRoot)).toBe(join(projectRoot, 'dist'));

		const token = encodeProjectPreviewToken(projectRoot);
		expect(resolveProjectPreviewAsset({
			token,
			env: { SPARK_PROJECT_PREVIEW_ROOTS: projectRoot }
		}).filePath).toBe(join(projectRoot, 'dist', 'index.html'));
		expect(resolveProjectPreviewAsset({
			token,
			assetPath: 'assets/index.js',
			env: { SPARK_PROJECT_PREVIEW_ROOTS: projectRoot }
		}).filePath).toBe(join(projectRoot, 'dist', 'assets', 'index.js'));
	});

	it('rewrites absolute preview asset links through the preview route', () => {
		expect(rewriteProjectPreviewHtml('<script src="/assets/app.js"></script><a href="/preview/keep">x</a>', 'abc12345')).toBe(
			'<script src="/preview/abc12345/assets/app.js"></script><a href="/preview/keep">x</a>'
		);
	});

	it('resolves index and relative assets inside an allowed project root', () => {
		const allowedRoot = mkdtempSync(join(tmpdir(), 'spark-preview-root-'));
		const projectRoot = join(allowedRoot, 'spark-demo');
		mkdirSync(projectRoot);
		writeFileSync(join(projectRoot, 'index.html'), '<link rel="stylesheet" href="styles.css">');
		writeFileSync(join(projectRoot, 'styles.css'), 'body { color: white; }');

		const token = encodeProjectPreviewToken(projectRoot);
		const env = { SPARK_PROJECT_PREVIEW_ROOTS: allowedRoot };

		expect(resolveProjectPreviewAsset({ token, env }).filePath).toBe(join(projectRoot, 'index.html'));
		expect(resolveProjectPreviewAsset({ token, assetPath: 'styles.css', env }).filePath).toBe(join(projectRoot, 'styles.css'));
	});

	it('rejects project folders outside configured preview roots', () => {
		const allowedRoot = mkdtempSync(join(tmpdir(), 'spark-preview-allowed-'));
		const outsideRoot = mkdtempSync(join(tmpdir(), 'spark-preview-outside-'));
		const token = encodeProjectPreviewToken(outsideRoot);

		expect(() =>
			resolveProjectPreviewAsset({ token, env: { SPARK_PROJECT_PREVIEW_ROOTS: allowedRoot } })
		).toThrow(ProjectPreviewError);
	});

	it('rejects asset traversal outside the project folder', () => {
		const allowedRoot = mkdtempSync(join(tmpdir(), 'spark-preview-root-'));
		const projectRoot = join(allowedRoot, 'spark-demo');
		mkdirSync(projectRoot);
		writeFileSync(join(projectRoot, 'index.html'), '<h1>ok</h1>');
		const token = encodeProjectPreviewToken(projectRoot);

		expect(() =>
			resolveProjectPreviewAsset({
				token,
				assetPath: '../secret.txt',
				env: { SPARK_PROJECT_PREVIEW_ROOTS: allowedRoot }
			})
		).toThrow(ProjectPreviewError);
	});

	it('allows hosted Railway preview origins declared by the environment', () => {
		expect(() =>
			assertProjectPreviewHost(new URL('https://spawner-ui-production.up.railway.app/preview/token/index.html'), {
				RAILWAY_PUBLIC_DOMAIN: 'spawner-ui-production.up.railway.app'
			})
		).not.toThrow();
	});

	it('includes hosted workspace roots in default preview allowlist', () => {
		const roots = getProjectPreviewAllowedRoots({
			SPARK_WORKSPACE_ROOT: '/data/workspaces'
		});

		expect(roots.some((root) => root.endsWith('data\\workspaces') || root.endsWith('/data/workspaces'))).toBe(true);
	});
});
