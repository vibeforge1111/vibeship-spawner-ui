import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireControlAuth = vi.fn();
vi.mock('$lib/server/mcp-auth', () => ({
	requireControlAuth: mockRequireControlAuth
}));

const mockExistsSync = vi.fn();
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockUnlink = vi.fn();
const mockMkdir = vi.fn();
vi.mock('fs', () => ({ existsSync: mockExistsSync }));
vi.mock('fs/promises', () => ({
	readFile: mockReadFile,
	writeFile: mockWriteFile,
	unlink: mockUnlink,
	mkdir: mockMkdir
}));

vi.mock('$lib/server/spawner-state', () => ({
	spawnerStateDir: () => '/tmp/spawner-state'
}));

vi.mock('$lib/utils/safe-json', () => ({
	parseJsonOrFallback: (_raw: string, fallback: unknown) => fallback
}));

function makeEvent(overrides: Record<string, unknown> = {}) {
	return {
		request: {
			headers: { get: vi.fn(() => null) },
			json: vi.fn(async () => ({}))
		},
		url: new URL('http://localhost:3333/api/mission/active'),
		cookies: { get: vi.fn(() => null) },
		...overrides
	};
}

function unauthorizedResponse() {
	return new Response('Unauthorized', { status: 401 });
}

describe('/api/mission/active auth checks', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExistsSync.mockReturnValue(false);
		mockReadFile.mockResolvedValue('{}');
	});

	describe('GET', () => {
		it('returns 401 when unauthenticated', async () => {
			mockRequireControlAuth.mockReturnValue(unauthorizedResponse());
			const { GET } = await import('$src/routes/api/mission/active/+server');
			const event = makeEvent();
			const res = await GET(event as never);
			expect(res.status).toBe(401);
		});

		it('auth check fires before any mission data is read', async () => {
			mockRequireControlAuth.mockReturnValue(unauthorizedResponse());
			const { GET } = await import('$src/routes/api/mission/active/+server');
			await GET(makeEvent() as never);
			expect(mockExistsSync).not.toHaveBeenCalled();
			expect(mockReadFile).not.toHaveBeenCalled();
		});

		it('authenticated GET proceeds normally when no active mission', async () => {
			mockRequireControlAuth.mockReturnValue(null);
			mockExistsSync.mockReturnValue(false);
			const { GET } = await import('$src/routes/api/mission/active/+server');
			const res = await GET(makeEvent() as never);
			const body = await res.json();
			expect(res.status).toBe(200);
			expect(body.active).toBe(false);
		});

		it('requireControlAuth is called with correct surface', async () => {
			mockRequireControlAuth.mockReturnValue(null);
			mockExistsSync.mockReturnValue(false);
			const { GET } = await import('$src/routes/api/mission/active/+server');
			const event = makeEvent();
			await GET(event as never);
			expect(mockRequireControlAuth).toHaveBeenCalledWith(
				event,
				expect.objectContaining({ surface: 'MissionActive' })
			);
		});
	});

	describe('POST', () => {
		it('returns 401 when unauthenticated', async () => {
			mockRequireControlAuth.mockReturnValue(unauthorizedResponse());
			const { POST } = await import('$src/routes/api/mission/active/+server');
			const res = await POST(makeEvent() as never);
			expect(res.status).toBe(401);
		});

		it('auth check fires before any mission data is written', async () => {
			mockRequireControlAuth.mockReturnValue(unauthorizedResponse());
			const { POST } = await import('$src/routes/api/mission/active/+server');
			await POST(makeEvent() as never);
			expect(mockWriteFile).not.toHaveBeenCalled();
			expect(mockMkdir).not.toHaveBeenCalled();
		});

		it('authenticated POST saves mission state', async () => {
			mockRequireControlAuth.mockReturnValue(null);
			mockExistsSync.mockReturnValue(true);
			mockWriteFile.mockResolvedValue(undefined);
			const event = makeEvent({
				request: {
					headers: { get: vi.fn(() => null) },
					json: vi.fn(async () => ({
						missionId: 'test-mission',
						missionName: 'Test',
						status: 'running',
						tasks: [],
						completedTasks: [],
						failedTasks: []
					}))
				}
			});
			const { POST } = await import('$src/routes/api/mission/active/+server');
			const res = await POST(event as never);
			expect(res.status).toBe(200);
		});
	});

	describe('DELETE', () => {
		it('returns 401 when unauthenticated', async () => {
			mockRequireControlAuth.mockReturnValue(unauthorizedResponse());
			const { DELETE } = await import('$src/routes/api/mission/active/+server');
			const res = await DELETE(makeEvent() as never);
			expect(res.status).toBe(401);
		});

		it('auth check fires before any mission data is deleted', async () => {
			mockRequireControlAuth.mockReturnValue(unauthorizedResponse());
			const { DELETE } = await import('$src/routes/api/mission/active/+server');
			await DELETE(makeEvent() as never);
			expect(mockUnlink).not.toHaveBeenCalled();
		});

		it('authenticated DELETE clears mission when file exists', async () => {
			mockRequireControlAuth.mockReturnValue(null);
			mockExistsSync.mockReturnValue(true);
			mockUnlink.mockResolvedValue(undefined);
			const { DELETE } = await import('$src/routes/api/mission/active/+server');
			const res = await DELETE(makeEvent() as never);
			const body = await res.json();
			expect(res.status).toBe(200);
			expect(body.success).toBe(true);
		});
	});
});
