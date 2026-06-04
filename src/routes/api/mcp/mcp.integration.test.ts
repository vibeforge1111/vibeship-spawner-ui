import { beforeEach, describe, expect, it, vi } from 'vitest';

const { PRIVATE_ENV } = vi.hoisted(() => ({
	PRIVATE_ENV: {
		MCP_API_KEY: '',
		MCP_ALLOWED_ORIGINS: '',
		MCP_ALLOW_CUSTOM_CONFIG: ''
	}
}));

vi.mock('$env/dynamic/private', () => ({ env: PRIVATE_ENV }));

vi.mock('$lib/services/mcp/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/services/mcp/client')>();
	return {
		...actual,
		connectMCP: vi.fn()
	};
});

import { POST } from './+server';
import { connectMCP } from '$lib/services/mcp/client';

function event(body: unknown) {
	return {
		request: new Request('http://127.0.0.1/api/mcp', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		url: new URL('http://127.0.0.1/api/mcp'),
		getClientAddress: () => '127.0.0.1'
	};
}

describe('/api/mcp', () => {
	beforeEach(() => {
		PRIVATE_ENV.MCP_ALLOW_CUSTOM_CONFIG = '';
		vi.mocked(connectMCP).mockReset();
		vi.mocked(connectMCP).mockResolvedValue({
			client: {} as never,
			transport: {} as never,
			serverInfo: { name: 'filesystem', version: '1.0.0' },
			tools: []
		});
	});

	it('blocks explicit MCP commands unless custom config is enabled', async () => {
		const response = await POST(event({
			instanceId: 'custom-command',
			command: 'npx',
			args: ['-y', 'unreviewed-mcp-package']
		}) as never);

		expect(response.status).toBe(403);
		expect(await response.json()).toMatchObject({
			error: expect.stringContaining('Custom MCP commands and npm packages are disabled')
		});
		expect(connectMCP).not.toHaveBeenCalled();
	});

	it('blocks registry npm package fallbacks unless custom config is enabled', async () => {
		const response = await POST(event({
			instanceId: 'registry-package',
			mcpId: 'community-server',
			npmPackage: 'unreviewed-mcp-package'
		}) as never);

		expect(response.status).toBe(403);
		expect(connectMCP).not.toHaveBeenCalled();
	});

	it('still allows preconfigured MCP ids without custom package input', async () => {
		const response = await POST(event({
			instanceId: 'filesystem',
			mcpId: 'filesystem'
		}) as never);

		expect(response.status).toBe(200);
		expect(connectMCP).toHaveBeenCalledWith(
			'filesystem',
			expect.objectContaining({ command: 'npx' })
		);
	});

	it('bounds connection failures without returning or logging local paths', async () => {
		const localPath = '/Users/alice/private/mcp-connect-cache.json';
		const errorMessages: string[] = [];
		const originalError = console.error;
		console.error = (...args: unknown[]) => {
			errorMessages.push(args.map(String).join(' '));
		};

		try {
			vi.mocked(connectMCP).mockRejectedValueOnce(new Error(`connect failed while reading ${localPath}`));

			const response = await POST(event({
				instanceId: 'filesystem',
				mcpId: 'filesystem'
			}) as never);

			expect(response.status).toBe(500);
			await expect(response.json()).resolves.toEqual({ error: 'MCP connection failed' });
		} finally {
			console.error = originalError;
		}

		expect(errorMessages.join('\n')).toContain('<local-path>');
		expect(errorMessages.join('\n')).not.toContain(localPath);
	});
});
