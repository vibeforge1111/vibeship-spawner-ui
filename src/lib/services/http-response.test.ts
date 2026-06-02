import { describe, expect, it } from 'vitest';
import { parseJsonResponse, responseStatusMessage, responseTextSnippet } from './http-response';

describe('HTTP response helpers', () => {
	it('falls back when a response is not JSON', async () => {
		const response = new Response('not-json', { status: 502 });

		await expect(parseJsonResponse(response, { ok: false })).resolves.toEqual({ ok: false });
	});

	it('bounds text snippets and collapses whitespace', async () => {
		const response = new Response('first line\nsecond line with a long tail', { status: 500 });

		await expect(responseTextSnippet(response, 17)).resolves.toBe('first line second');
	});

	it('includes status and bounded text for UI errors', async () => {
		const response = new Response('temporary upstream failure', { status: 503 });

		await expect(responseStatusMessage(response, 'Dispatch failed', 9)).resolves.toBe(
			'Dispatch failed (HTTP 503): temporary'
		);
	});
});
