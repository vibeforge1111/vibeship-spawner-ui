import { describe, expect, it } from 'vitest';
import { POST as analyzePost } from './analyze/+server';
import { POST as scanPost } from './scan/+server';
import { POST as verifyPost } from './verify/+server';
import { POST as prdBridgeWritePost } from './prd-bridge/write/+server';

function loopbackEvent(path: string) {
	return {
		request: new Request(`http://127.0.0.1${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{not valid json'
		}),
		getClientAddress: () => '127.0.0.1',
		cookies: { get: () => undefined }
	};
}

describe('API malformed JSON handling', () => {
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
