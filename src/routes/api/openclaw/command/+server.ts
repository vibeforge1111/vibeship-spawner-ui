import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	openclawBridge,
	OPENCLAW_ALLOWED_COMMANDS,
	type OpenclawCommandName
} from '$lib/services/openclaw-bridge';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedCommand(value: string): value is OpenclawCommandName {
	return (OPENCLAW_ALLOWED_COMMANDS as string[]).includes(value);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		if (!isRecord(body)) {
			return json({ success: false, error: 'Invalid request body' }, { status: 400 });
		}

		const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;
		const command = typeof body.command === 'string' ? body.command : null;
		if (!sessionId || !command) {
			return json({ success: false, error: 'sessionId and command are required' }, { status: 400 });
		}
		if (!isAllowedCommand(command)) {
			return json(
				{
					success: false,
					error: `Unsupported command "${command}"`,
					allowedCommands: OPENCLAW_ALLOWED_COMMANDS
				},
				{ status: 400 }
			);
		}

		const result = await openclawBridge.executeCommand({
			sessionId,
			command,
			params: isRecord(body.params) ? body.params : {},
			requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
			actor: typeof body.actor === 'string' ? body.actor : undefined
		});

		return json(
			{
				success: result.ok,
				sessionId: result.sessionId,
				command: result.command,
				requestId: result.requestId,
				data: result.data,
				error: result.error
			},
			{ status: result.ok ? 200 : 400 }
		);
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Command failed'
			},
			{ status: 400 }
		);
	}
};
