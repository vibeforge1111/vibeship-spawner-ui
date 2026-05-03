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
	resolveProjectPreviewAsset
} from './project-preview';

describe('project-preview', () => {
	it('creates stable localhost preview URLs for static project folders', () => {
		const projectPath = resolve('C:/Users/USER/Desktop/spark-demo');
		const url = projectPreviewUrl('http://127.0.0.1:5555/', projectPath);

		expect(url).toMatch(/^http:\/\/127\.0\.0\.1:5555\/preview\/[A-Za-z0-9_-]+\/index\.html$/);
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
