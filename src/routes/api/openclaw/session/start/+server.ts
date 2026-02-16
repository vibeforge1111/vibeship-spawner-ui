import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openclawBridge } from '$lib/services/openclaw-bridge';

function parseBody(value: unknown): { sessionId?: string; actor?: string; metadata?: Record<string, unknown> } {
	if (!value || typeof value !== 'object') {
		return {};
	}
	const body = value as Record<string, unknown>;
	return {
		sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
		actor: typeof body.actor === 'string' ? body.actor : undefined,
		metadata:
			body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
				? (body.metadata as Record<string, unknown>)
				: undefined
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = parseBody(await request.json().catch(() => ({})));
		const session = openclawBridge.startSession(body);
		return json({
			success: true,
			session: {
				id: session.id,
				status: session.status,
				createdAt: session.createdAt,
				eventsEndpoint: `/api/openclaw/events?sessionId=${encodeURIComponent(session.id)}`,
				commandEndpoint: '/api/openclaw/command'
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to start session'
			},
			{ status: 400 }
		);
	}
};
