#!/usr/bin/env node

const baseUrl = (process.env.SPAWNER_SMOKE_BASE_URL || 'http://127.0.0.1:3333').replace(/\/$/, '');
const stamp = Date.now();
const requestId = `smoke-surfaces-${stamp}`;
const missionId = `mission-${stamp}`;
const projectName = 'Spark Mission Surface Smoke';
const tasks = [
	{
		id: 'task-1-plan-route',
		title: 'Plan route smoke',
		summary: 'Create the project canvas and planned mission tasks.',
		skills: ['mission-control'],
		dependencies: [],
		acceptanceCriteria: ['Canvas can be opened from a mission-scoped URL.'],
		verificationCommands: ['npm run smoke:routes']
	},
	{
		id: 'task-2-verify-surfaces',
		title: 'Verify mission surfaces',
		summary: 'Check Kanban, mission detail, trace, and Spark agent surfaces.',
		skills: ['testing'],
		dependencies: ['task-1-plan-route'],
		acceptanceCriteria: ['Trace reports a completed mission with 100% task progress.'],
		verificationCommands: ['npm run smoke:mission-surfaces']
	}
];

function url(path) {
	return `${baseUrl}${path}`;
}

async function postJson(path, body) {
	const response = await fetch(url(path), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
	const text = await response.text();
	const parsed = text ? JSON.parse(text) : null;
	if (!response.ok) {
		throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
	}
	return parsed;
}

async function getJson(path) {
	const response = await fetch(url(path));
	const text = await response.text();
	const parsed = text ? JSON.parse(text) : null;
	if (!response.ok) {
		throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
	}
	return parsed;
}

async function getHtml(path, expectedPathname) {
	const response = await fetch(url(path));
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
	}
	if (expectedPathname && new URL(response.url).pathname !== expectedPathname) {
		throw new Error(`${path} redirected to ${new URL(response.url).pathname}`);
	}
	if (!text.trim().startsWith('<!doctype html>') && !response.headers.get('content-type')?.includes('text/html')) {
		throw new Error(`${path} did not return HTML`);
	}
	return text;
}

async function waitFor(description, probe, timeoutMs = 6000) {
	const started = Date.now();
	let lastError = null;
	while (Date.now() - started < timeoutMs) {
		try {
			const result = await probe();
			if (result) return result;
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 150));
	}
	throw new Error(`${description} did not become true${lastError ? `: ${lastError.message}` : ''}`);
}

function findMission(board, bucket) {
	return (board?.[bucket] || []).find((entry) => entry.missionId === missionId);
}

async function relay(type, data = {}) {
	return postJson('/api/events', {
		type,
		missionId,
		missionName: projectName,
		taskId: data.taskId,
		taskName: data.taskName,
		message: data.message,
		source: data.source || 'smoke-script',
		timestamp: new Date().toISOString(),
		data: {
			requestId,
			plannedTasks: tasks.map((task) => ({ title: task.title, skills: task.skills })),
			telegramRelay: { profile: 'smoke', port: 3333 },
			...data.data
		}
	});
}

const checks = [];
async function check(name, fn) {
	try {
		const detail = await fn();
		checks.push({ name, ok: true, detail });
	} catch (error) {
		checks.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
	}
}

await check('store PRD result', async () => {
	const result = await postJson('/api/prd-bridge/result', {
		requestId,
		result: {
			success: true,
			projectName,
			executionPrompt: 'Synthetic smoke mission. Do not dispatch a real provider.',
			tasks
		}
	});
	if (result?.success !== true) throw new Error('PRD result was not stored');
	return requestId;
});

await check('load mission canvas without auto-run', async () => {
	const result = await postJson('/api/prd-bridge/load-to-canvas', {
		requestId,
		missionId,
		autoRun: false,
		buildMode: 'direct',
		telegramRelay: { profile: 'smoke', port: 3333 },
		chatId: 'smoke-chat',
		userId: 'smoke-user',
		goal: 'Run Mission Control surface smoke.'
	});
	if (result?.success !== true) throw new Error('Canvas load failed');
	if (result?.canvasUrl !== `/canvas?pipeline=prd-${requestId}&mission=${missionId}`) {
		throw new Error(`Unexpected canvasUrl: ${result?.canvasUrl}`);
	}
	return result.canvasUrl;
});

await check('relay mission lifecycle to completion', async () => {
	await relay('dispatch_started', {
		message: 'Surface smoke dispatch started.',
		data: { providers: ['codex'] }
	});
	for (const task of tasks) {
		await relay('task_started', { taskId: task.id, taskName: task.title });
		await relay('task_completed', { taskId: task.id, taskName: task.title });
	}
	await relay('mission_completed', {
		source: 'codex',
		message: 'Mission surface smoke completed.',
		data: { provider: 'codex', response: 'Mission surface smoke completed.' }
	});
	return 'completed';
});

await check('Kanban board shows completed task rollup', async () => {
	const entry = await waitFor('completed board entry', async () => {
		const body = await getJson('/api/mission-control/board');
		if (body?.ok !== true) throw new Error('Board response was not ok');
		return findMission(body.board, 'completed');
	});
	if (entry.taskStatusCounts?.completed !== tasks.length || entry.taskStatusCounts?.total !== tasks.length) {
		throw new Error(`Unexpected task counts: ${JSON.stringify(entry.taskStatusCounts)}`);
	}
	return `${entry.taskStatusCounts.completed}/${entry.taskStatusCounts.total} complete`;
});

await check('Mission detail route stays inspectable', async () => {
	await getHtml(`/missions/${missionId}`, `/missions/${missionId}`);
	return `/missions/${missionId}`;
});

await check('Canvas route stays mission-scoped', async () => {
	await getHtml(`/canvas?pipeline=prd-${requestId}&mission=${missionId}`, '/canvas');
	return `/canvas?pipeline=prd-${requestId}&mission=${missionId}`;
});

await check('Trace stitches mission, canvas, kanban, and dispatch', async () => {
	const trace = await waitFor('completed trace', async () => {
		const body = await getJson(`/api/mission-control/trace?missionId=${missionId}&requestId=${requestId}`);
		if (body?.ok !== true) throw new Error('Trace response was not ok');
		return body.phase === 'completed' ? body : null;
	});
	if (trace.progress?.percent !== 100) throw new Error(`Trace progress was ${trace.progress?.percent}`);
	if (trace.surfaces?.canvas?.pipelineId !== `prd-${requestId}`) {
		throw new Error(`Trace canvas pipeline mismatch: ${trace.surfaces?.canvas?.pipelineId}`);
	}
	if (trace.surfaces?.kanban?.bucket !== 'completed') {
		throw new Error(`Trace Kanban bucket mismatch: ${trace.surfaces?.kanban?.bucket}`);
	}
	if (trace.surfaces?.dispatch?.lastReason !== 'Mission completed from lifecycle event') {
		throw new Error(`Trace dispatch reason mismatch: ${trace.surfaces?.dispatch?.lastReason}`);
	}
	if (trace.timeline?.[0]?.eventType !== 'mission_completed') {
		throw new Error(`Trace timeline did not end with mission_completed: ${trace.timeline?.[0]?.eventType}`);
	}
	return `${trace.phase} ${trace.progress.percent}%`;
});

await check('Spark agent canvas-state API remains reachable', async () => {
	const body = await getJson('/api/spark-agent/canvas-state');
	if (body?.success !== true) throw new Error('Spark agent canvas-state was not successful');
	return body.hasUpdate ? 'snapshot available' : 'no snapshot yet';
});

for (const result of checks) {
	const line = result.ok ? `PASS ${result.name}` : `FAIL ${result.name}`;
	const detail = result.detail ? ` - ${result.detail}` : '';
	(result.ok ? console.log : console.error)(`${line}${detail}`);
}

if (checks.some((result) => !result.ok)) {
	process.exitCode = 1;
}
