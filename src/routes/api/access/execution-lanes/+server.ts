import { env } from '$env/dynamic/private';
import { json, type RequestEvent, type RequestHandler } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';
import {
	recommendAccessExecutionLane,
	type AccessExecutionLane
} from '$lib/server/access-execution-lanes';
import { hostedUiSessionIsValid } from '$lib/server/hosted-ui-auth';

function accessLevelFromUrl(url: URL): 4 | 5 {
	return url.searchParams.get('accessLevel') === '5' ? 5 : 4;
}

function constantTimeEquals(left: string, right: string): boolean {
	const leftBuffer = Buffer.from(left);
	const rightBuffer = Buffer.from(right);
	return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function requestToken(request: Request, url: URL): string | null {
	const headerToken =
		request.headers.get('x-spawner-ui-key') ||
		request.headers.get('x-api-key') ||
		request.headers.get('x-mcp-api-key');
	if (headerToken?.trim()) return headerToken.trim();

	const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
	if (bearer) return bearer;

	const queryToken = url.searchParams.get('uiKey') || url.searchParams.get('apiKey');
	return queryToken?.trim() || null;
}

function localPathAccessIsAuthorized(event: RequestEvent): boolean {
	if (event.cookies && hostedUiSessionIsValid(event.cookies, env)) return true;

	const token = requestToken(event.request, event.url);
	if (!token) return false;

	const allowedTokens = [
		env.SPARK_UI_API_KEY,
		process.env.SPARK_UI_API_KEY,
		env.SPARK_BRIDGE_API_KEY,
		process.env.SPARK_BRIDGE_API_KEY,
		env.MCP_API_KEY,
		process.env.MCP_API_KEY
	]
		.map((value) => value?.trim())
		.filter((value): value is string => Boolean(value));
	return allowedTokens.some((allowedToken) => constantTimeEquals(allowedToken, token));
}

function redactLocalPaths(lane: AccessExecutionLane): AccessExecutionLane {
	if (!lane.workspaceRoot) return lane;
	const redacted = { ...lane };
	delete redacted.workspaceRoot;
	return {
		...redacted,
		userMessage:
			lane.id === 'spark_workspace'
				? 'I can set up a safe Spark workspace and work only inside it.'
				: redacted.userMessage
	};
}

export const GET: RequestHandler = async (event) => {
	const { url } = event;
	const accessLevel = accessLevelFromUrl(url);
	const goal = url.searchParams.get('goal') || undefined;
	const access = recommendAccessExecutionLane({
		accessLevel,
		userGoal: goal
	});
	const responseAccess = localPathAccessIsAuthorized(event)
		? access
		: {
				...access,
				recommended: redactLocalPaths(access.recommended),
				lanes: access.lanes.map(redactLocalPaths)
			};

	return json({
		success: true,
		access: responseAccess
	});
};
