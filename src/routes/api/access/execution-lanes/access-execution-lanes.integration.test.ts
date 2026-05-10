import { describe, expect, it } from 'vitest';
import { GET } from './+server';

function routeEvent(url: string) {
	return {
		request: new Request(url),
		url: new URL(url)
	};
}

describe('/api/access/execution-lanes', () => {
	it('returns a nontechnical Level 4 execution-lane status by default', async () => {
		const response = await GET(routeEvent('http://127.0.0.1/api/access/execution-lanes') as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			access: {
				recommended: {
					id: 'spark_workspace',
					setupMode: 'automatic',
					sparkCliAction: 'spark access setup sandbox'
				}
			}
		});
		expect(body.access.recommended.userMessage).toContain('safe Spark workspace');
	});

	it('returns Level 5 as blocked unless operator guardrails are enabled', async () => {
		const response = await GET(
			routeEvent('http://127.0.0.1/api/access/execution-lanes?accessLevel=5') as never
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.access.recommended.id).toBe('spark_workspace');
		expect(body.access.lanes[0]).toMatchObject({
			id: 'level5_operator',
			available: false,
			setupMode: 'blocked'
		});
	});
});
