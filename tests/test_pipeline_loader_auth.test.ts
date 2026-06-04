import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/mcp-auth', () => ({
	requireControlAuth: vi.fn()
}));
vi.mock('$lib/server/spawner-state', () => ({
	spawnerStateDir: vi.fn(() => '/tmp/spawner-test')
}));
vi.mock('$lib/utils/logger', () => ({
	logger: { scope: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }
}));
vi.mock('fs', () => ({
	existsSync: vi.fn(() => false)
}));
vi.mock('fs/promises', () => ({
	writeFile: vi.fn(),
	readFile: vi.fn(),
	unlink: vi.fn(),
	mkdir: vi.fn()
}));
vi.mock('$lib/utils/safe-json', () => ({
	parseJsonOrFallback: vi.fn(() => ({}))
}));

import { requireControlAuth } from '$lib/server/mcp-auth';

const UNAUTHORIZED = new Response('Unauthorized', { status: 401 });

function makeEvent(overrides: Record<string, unknown> = {}) {
	return {
		request: {
			json: vi.fn().mockResolvedValue({ pipelineId: 'p1', pipelineName: 'Test' })
		},
		url: new URL('http://localhost/api/pipeline-loader'),
		...overrides
	} as unknown as Parameters<typeof import('../src/routes/api/pipeline-loader/+server')['POST']>[0];
}

describe('/api/pipeline-loader auth', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('POST returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { POST } = await import('../src/routes/api/pipeline-loader/+server');
		const response = await POST(makeEvent());
		expect(response.status).toBe(401);
	});

	it('GET returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { GET } = await import('../src/routes/api/pipeline-loader/+server');
		const response = await GET(makeEvent());
		expect(response.status).toBe(401);
	});

	it('DELETE returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { DELETE } = await import('../src/routes/api/pipeline-loader/+server');
		const response = await DELETE(makeEvent());
		expect(response.status).toBe(401);
	});

	it('POST auth check fires before any file write', async () => {
		const { writeFile } = await import('fs/promises');
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { POST } = await import('../src/routes/api/pipeline-loader/+server');
		await POST(makeEvent());
		expect(writeFile).not.toHaveBeenCalled();
	});

	it('injected executionPrompt from unauth caller never reaches pipeline queue', async () => {
		const { writeFile } = await import('fs/promises');
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { POST } = await import('../src/routes/api/pipeline-loader/+server');
		const event = makeEvent({
			request: {
				json: vi.fn().mockResolvedValue({
					pipelineId: 'evil',
					pipelineName: 'Attack',
					executionPrompt: '__INJECT__;rm -rf /'
				})
			}
		});
		await POST(event);
		expect(writeFile).not.toHaveBeenCalled();
	});

	it('authenticated POST proceeds normally', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(undefined);
		const { writeFile } = await import('fs/promises');
		vi.mocked(writeFile).mockResolvedValue(undefined);
		const { existsSync } = await import('fs');
		vi.mocked(existsSync).mockReturnValue(false);
		const { mkdir } = await import('fs/promises');
		vi.mocked(mkdir).mockResolvedValue(undefined);
		const { POST } = await import('../src/routes/api/pipeline-loader/+server');
		const response = await POST(makeEvent());
		expect(response.status).not.toBe(401);
	});
});
