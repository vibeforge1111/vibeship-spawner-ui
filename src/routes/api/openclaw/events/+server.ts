import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openclawBridge } from '$lib/services/openclaw-bridge';

export const GET: RequestHandler = async ({ request, url }) => {
	const sessionId = url.searchParams.get('sessionId');
	if (!sessionId) {
		return json({ error: 'sessionId is required' }, { status: 400 });
	}

	const session = openclawBridge.getSession(sessionId);
	if (!session) {
		return json({ error: `Unknown session: ${sessionId}` }, { status: 404 });
	}

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let closed = false;
			const push = (payload: unknown) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
				} catch {
					closed = true;
				}
			};

			push({
				type: 'connected',
				sessionId,
				timestamp: new Date().toISOString()
			});

			for (const event of session.events) {
				push(event);
			}

			const unsubscribe = openclawBridge.subscribe(sessionId, (event) => {
				push(event);
			});

			request.signal.addEventListener('abort', () => {
				unsubscribe();
				if (!closed) {
					closed = true;
					try {
						controller.close();
					} catch {
						// stream already closed
					}
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
