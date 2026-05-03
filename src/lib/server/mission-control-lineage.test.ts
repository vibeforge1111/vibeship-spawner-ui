import { afterEach, describe, expect, it } from 'vitest';
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
});
