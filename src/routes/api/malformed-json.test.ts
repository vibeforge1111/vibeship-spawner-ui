import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as analyzePost } from './analyze/+server';
import { POST as scanPost } from './scan/+server';
import { POST as verifyPost } from './verify/+server';
import { POST as prdBridgeWritePost } from './prd-bridge/write/+server';

const TEST_API_KEY = 'test-secret';
let originalMcpApiKey: string | undefined;
let originalBridgeApiKey: string | undefined;

function loopbackEvent(path: string) {
	return {
		request: new Request(`http://127.0.0.1${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-api-key': TEST_API_KEY },
			body: '{not valid json'
		}),
		getClientAddress: () => '127.0.0.1',
		cookies: { get: () => undefined }
	};
}

describe('API malformed JSON handling', () => {
	beforeEach(() => {
		originalMcpApiKey = process.env.MCP_API_KEY;
		originalBridgeApiKey = process.env.SPARK_BRIDGE_API_KEY;
		process.env.MCP_API_KEY = TEST_API_KEY;
		process.env.SPARK_BRIDGE_API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		if (originalMcpApiKey === undefined) {
			delete process.env.MCP_API_KEY;
		} else {
			process.env.MCP_API_KEY = originalMcpApiKey;
		}
		if (originalBridgeApiKey === undefined) {
			delete process.env.SPARK_BRIDGE_API_KEY;
		} else {
			process.env.SPARK_BRIDGE_API_KEY = originalBridgeApiKey;
		}
	});

	it.each([
		['/api/analyze', analyzePost],
		['/api/scan', scanPost],
		['/api/verify', verifyPost],
		['/api/prd-bridge/write', prdBridgeWritePost]
	])('%s returns 400 for malformed JSON bodies', async (path, handler) => {
		const response = await handler(loopbackEvent(path) as never);
		const payload = await response.json();

		expect(response.status).toBe(400);
		expect(payload).toEqual({ error: 'Malformed JSON body' });
	});
});
