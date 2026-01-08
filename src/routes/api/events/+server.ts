/**
 * Event Bridge API - Receives events from Claude Code and broadcasts to spawner-ui
 *
 * POST /api/events - Receive an event from Claude Code
 * GET /api/events - SSE stream for real-time event updates
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eventBridge } from '$lib/services/event-bridge';

/**
 * POST handler - receives events from Claude Code
 * Claude can call: curl -X POST http://localhost:5173/api/events -d '{"type":"progress",...}'
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const event = await request.json();

		// Validate required fields
		if (!event.type) {
			return json({ error: 'Event type is required' }, { status: 400 });
		}

		// Add metadata
		const fullEvent = {
			...event,
			timestamp: event.timestamp || new Date().toISOString(),
			source: event.source || 'claude-code',
			id: event.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		};

		// Broadcast to all connected clients
		eventBridge.emit(fullEvent);

		return json({ success: true, eventId: fullEvent.id });
	} catch (error) {
		console.error('[EventBridge] Error processing event:', error);
		return json({ error: 'Invalid event data' }, { status: 400 });
	}
};

/**
 * GET handler - Server-Sent Events stream for real-time updates
 */
export const GET: RequestHandler = async ({ request }) => {
	const stream = new ReadableStream({
		start(controller) {
			// Send initial connection message
			const encoder = new TextEncoder();
			let isClosed = false;

			controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`));

			// Subscribe to events
			const unsubscribe = eventBridge.subscribe((event) => {
				if (isClosed) return;
				try {
					const data = `data: ${JSON.stringify(event)}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch (e) {
					// Client disconnected
					isClosed = true;
					console.log('[EventBridge] Client disconnected');
				}
			});

			// Handle client disconnect
			request.signal.addEventListener('abort', () => {
				unsubscribe();
				if (!isClosed) {
					isClosed = true;
					try {
						controller.close();
					} catch (e) {
						// Controller already closed, ignore
					}
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'Access-Control-Allow-Origin': '*'
		}
	});
};
