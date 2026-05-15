import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { encodeProjectPreviewToken } from './project-preview';
import { extractMissionControlProjectLineage } from './mission-control-lineage';

const originalRailwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
const originalPreviewBaseUrl = process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL;

afterEach(() => {
	if (originalRailwayPublicDomain === undefined) {
		delete process.env.RAILWAY_PUBLIC_DOMAIN;
	} else {
		process.env.RAILWAY_PUBLIC_DOMAIN = originalRailwayPublicDomain;
	}
	if (originalPreviewBaseUrl === undefined) {
		delete process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL;
	} else {
		process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL = originalPreviewBaseUrl;
	}
});

describe('mission-control-lineage', () => {
	it('uses the Railway public domain for hosted project previews', () => {
		delete process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL;
		process.env.RAILWAY_PUBLIC_DOMAIN = 'spawner-ui-production.up.railway.app';

		const lineage = extractMissionControlProjectLineage({
			data: { projectPath: '/data/workspaces/mission-1-cafe' }
		});

		expect(lineage?.previewUrl).toMatch(
			/^https:\/\/spawner-ui-production\.up\.railway\.app\/preview\/[A-Za-z0-9_-]+\/index\.html$/
		);
	});

	it('refreshes stale root preview URLs when the playable app is nested', () => {
		process.env.SPAWNER_PROJECT_PREVIEW_BASE_URL = 'http://127.0.0.1:3333';
		const projectRoot = mkdtempSync(join(tmpdir(), 'spark-lineage-preview-'));
		const nestedRoot = join(projectRoot, 'fail', 'restart');
		mkdirSync(nestedRoot, { recursive: true });
		writeFileSync(join(nestedRoot, 'index.html'), '<h1>nested app</h1>');

		const stalePreviewUrl = `http://127.0.0.1:3333/preview/${encodeProjectPreviewToken(projectRoot)}/index.html`;
		const lineage = extractMissionControlProjectLineage({
			data: { projectPath: projectRoot, previewUrl: stalePreviewUrl }
		});

		expect(lineage?.previewUrl).not.toBe(stalePreviewUrl);
		expect(lineage?.previewUrl).toContain(encodeProjectPreviewToken(nestedRoot));
	});
});
