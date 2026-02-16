import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openclawBridge } from '$lib/services/openclaw-bridge';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
		const reason = typeof body.reason === 'string' ? body.reason : 'requested';
		if (!sessionId) {
			return json({ success: false, error: 'sessionId is required' }, { status: 400 });
		}

		const session = openclawBridge.endSession(sessionId, reason);
		return json({
			success: true,
			session: {
				id: session.id,
				status: session.status,
				endedAt: session.endedAt,
				updatedAt: session.updatedAt
			}
		});
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Failed to end session'
			},
			{ status: 404 }
		);
	}
};
