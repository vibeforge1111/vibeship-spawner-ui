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
	readFile: vi.fn(),
	writeFile: vi.fn(),
	unlink: vi.fn(),
	mkdir: vi.fn()
}));
vi.mock('$lib/server/path-safety', () => ({
	assertSafeId: vi.fn(),
	PathSafetyError: class extends Error { status = 400; },
	resolveWithinBaseDir: vi.fn((base: string, file: string) => `${base}/${file}`)
}));
vi.mock('$lib/server/prd-analysis-result-schema', () => ({
	projectStoredPrdAnalysisResultForTier: vi.fn().mockResolvedValue({})
}));

import { requireControlAuth } from '$lib/server/mcp-auth';

const UNAUTHORIZED = new Response('Unauthorized', { status: 401 });

function makeEvent(overrides: Record<string, unknown> = {}) {
	return {
		request: {
			json: vi.fn().mockResolvedValue({ requestId: 'req-1', result: {} })
		},
		url: new URL('http://localhost/api/prd-bridge/result'),
		...overrides
	} as unknown as Parameters<typeof import('../src/routes/api/prd-bridge/pending/+server')['GET']>[0];
}

describe('/api/prd-bridge/pending auth', () => {
	beforeEach(() => vi.clearAllMocks());

	it('GET /pending returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { GET } = await import('../src/routes/api/prd-bridge/pending/+server');
		const response = await GET(makeEvent());
		expect(response.status).toBe(401);
	});

	it('DELETE /pending returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { DELETE } = await import('../src/routes/api/prd-bridge/pending/+server');
		const response = await DELETE(makeEvent());
		expect(response.status).toBe(401);
	});

	it('authenticated GET /pending proceeds', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(undefined);
		const { GET } = await import('../src/routes/api/prd-bridge/pending/+server');
		const response = await GET(makeEvent());
		expect(response.status).not.toBe(401);
	});
});

describe('/api/prd-bridge/result auth', () => {
	beforeEach(() => vi.clearAllMocks());

	it('POST /result returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { POST } = await import('../src/routes/api/prd-bridge/result/+server');
		const response = await POST(makeEvent());
		expect(response.status).toBe(401);
	});

	it('GET /result returns 401 for unauthenticated request', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { GET } = await import('../src/routes/api/prd-bridge/result/+server');
		const response = await GET(makeEvent());
		expect(response.status).toBe(401);
	});

	it('fake result injection from unauth caller blocked — writeFile not called', async () => {
		const { writeFile } = await import('fs/promises');
		vi.mocked(requireControlAuth).mockReturnValue(UNAUTHORIZED);
		const { POST } = await import('../src/routes/api/prd-bridge/result/+server');
		await POST(makeEvent({
			request: { json: vi.fn().mockResolvedValue({ requestId: 'evil', result: { fake: true } }) }
		}));
		expect(writeFile).not.toHaveBeenCalled();
	});

	it('authenticated POST /result proceeds', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(undefined);
		const { writeFile, mkdir } = await import('fs/promises');
		vi.mocked(writeFile).mockResolvedValue(undefined);
		vi.mocked(mkdir).mockResolvedValue(undefined);
		const { POST } = await import('../src/routes/api/prd-bridge/result/+server');
		const response = await POST(makeEvent());
		expect(response.status).not.toBe(401);
	});

	it('authenticated GET /result proceeds', async () => {
		vi.mocked(requireControlAuth).mockReturnValue(undefined);
		const { GET } = await import('../src/routes/api/prd-bridge/result/+server');
		const event = makeEvent({ url: new URL('http://localhost/api/prd-bridge/result?requestId=req-1') });
		const response = await GET(event);
		expect(response.status).not.toBe(401);
	});
});
