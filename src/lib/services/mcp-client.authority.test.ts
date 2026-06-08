import { afterEach, describe, expect, it, vi } from 'vitest';
import { mcpClient } from './mcp-client';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('MCP client authority contract', () => {
	it('fails closed for legacy mission lifecycle execution verbs', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		const start = await mcpClient.startMission('mission-legacy-start');
		const complete = await mcpClient.completeMission('mission-legacy-complete');
		const fail = await mcpClient.failMission('mission-legacy-fail', 'legacy failure');

		for (const result of [start, complete, fail]) {
			expect(result.success).toBe(false);
			expect(result.error).toContain('Legacy MCP mission lifecycle actions are disabled');
		}
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
