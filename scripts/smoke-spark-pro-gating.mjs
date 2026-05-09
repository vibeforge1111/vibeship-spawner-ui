import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const PORT = Number(process.env.SPARK_PRO_GATING_SMOKE_PORT || 3375);
const BASE_URL = process.env.SPARK_PRO_GATING_BASE_URL || `http://127.0.0.1:${PORT}`;
const startedHere = !process.env.SPARK_PRO_GATING_BASE_URL;
const freeSkillId = process.env.SPARK_PRO_GATING_FREE_SKILL || 'frontend-engineer';
const proSkillId = process.env.SPARK_PRO_GATING_PRO_SKILL || 'usage-metering-entitlements';
const legacyProBearerEnv = ['SPARK_PRO', 'BEARER', 'TOKEN'].join('_');
let token =
	process.env[legacyProBearerEnv] ||
	process.env.SPARK_MCP_TOKEN ||
	process.env.SPARK_PRO_GATING_TOKEN ||
	'';
const useMockEntitlements = ['1', 'true', 'yes'].includes(
	String(process.env.SPARK_PRO_GATING_MOCK_ENTITLEMENTS || '').toLowerCase()
);
const requireToken = ['1', 'true', 'yes'].includes(
	String(process.env.SPARK_PRO_GATING_REQUIRE_TOKEN || '').toLowerCase()
);

function fail(message) {
	console.error(`spark-pro-gating smoke failed: ${message}`);
	process.exitCode = 1;
}

async function waitForServer(child) {
	const deadline = Date.now() + 15_000;
	let lastError;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`server exited before smoke test started with code ${child.exitCode}`);
		}
		try {
			const response = await fetch(BASE_URL, { redirect: 'manual' });
			if (response.status > 0) return;
		} catch (error) {
			lastError = error;
		}
		await new Promise((resolve) => setTimeout(resolve, 250));
	}
	throw lastError || new Error('server did not start before timeout');
}

async function readJson(response) {
	const text = await response.text();
	return text ? JSON.parse(text) : {};
}

async function expectStatus(path, expectedStatus, init = {}) {
	const response = await fetch(`${BASE_URL}${path}`, {
		redirect: 'manual',
		...init,
		headers: {
			accept: 'application/json',
			...(init.headers || {})
		}
	});
	if (response.status !== expectedStatus) {
		fail(`${path} returned ${response.status}, expected ${expectedStatus}`);
	}
	return response;
}

function startMockEntitlements() {
	const successToken = token || 'spark-pro-gating-ci-token';
	const server = createServer((request, response) => {
		if (request.url !== '/api/member/entitlements') {
			response.writeHead(404, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ error: 'not_found' }));
			return;
		}

		if (request.headers.authorization === `Bearer ${successToken}`) {
			response.writeHead(200, { 'content-type': 'application/json' });
			response.end(JSON.stringify({ features: ['drop.skills'] }));
			return;
		}

		response.writeHead(401, { 'content-type': 'application/json' });
		response.end(JSON.stringify({ error: { code: 'not_authenticated' } }));
	});

	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve(server));
	});
}

async function closeServer(server) {
	if (!server) return;
	await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

async function runSmoke() {
	let child;
	let mockEntitlements;
	if (startedHere) {
		if (useMockEntitlements) {
			mockEntitlements = await startMockEntitlements();
			const { port } = mockEntitlements.address();
			process.env.SPARK_PRO_API_BASE_URL = `http://127.0.0.1:${port}`;
			if (!process.env.SPARK_PRO_GATING_TOKEN && !process.env[legacyProBearerEnv] && !process.env.SPARK_MCP_TOKEN) {
				process.env.SPARK_PRO_GATING_TOKEN = 'spark-pro-gating-ci-token';
				token = process.env.SPARK_PRO_GATING_TOKEN;
			}
		}

		child = spawn(process.execPath, ['build'], {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: {
				...process.env,
				PORT: String(PORT)
			}
		});

		child.stdout.on('data', (chunk) => process.stdout.write(chunk));
		child.stderr.on('data', (chunk) => process.stderr.write(chunk));
		await waitForServer(child);
	}

	try {
		const freeResponse = await expectStatus(`/api/h70-skills/${encodeURIComponent(freeSkillId)}`, 200);
		const freeBody = await readJson(freeResponse);
		if (freeBody.skill?.id !== freeSkillId) {
			fail(`free skill response did not include skill id ${freeSkillId}`);
		}

		const missingResponse = await expectStatus(`/api/h70-skills/${encodeURIComponent(proSkillId)}`, 401);
		if (!missingResponse.headers.get('www-authenticate')?.includes('scope="drop.skills"')) {
			fail('missing proof response did not advertise drop.skills scope');
		}
		const missingBody = await readJson(missingResponse);
		if (missingBody.error?.code !== 'spark_pro_proof_required') {
			fail('missing proof response did not return spark_pro_proof_required');
		}

		const headResponse = await expectStatus(`/api/h70-skills/${encodeURIComponent(proSkillId)}`, 401, {
			method: 'HEAD'
		});
		if (!headResponse.headers.get('www-authenticate')?.includes('scope="drop.skills"')) {
			fail('HEAD missing proof response did not advertise drop.skills scope');
		}

		const invalidResponse = await expectStatus(`/api/h70-skills/${encodeURIComponent(proSkillId)}`, 401, {
			headers: { authorization: 'Bearer invalid-spark-pro-token' }
		});
		const invalidBody = await readJson(invalidResponse);
		if (invalidBody.error?.code !== 'spark_pro_proof_invalid') {
			fail('invalid proof response did not return spark_pro_proof_invalid');
		}

		if (token) {
			const proResponse = await expectStatus(`/api/h70-skills/${encodeURIComponent(proSkillId)}`, 200, {
				headers: { authorization: `Bearer ${token}` }
			});
			const proBody = await readJson(proResponse);
			if (proBody.skill?.id !== proSkillId) {
				fail(`Pro skill response did not include skill id ${proSkillId}`);
			}
		} else if (requireToken) {
			fail('SPARK_MCP_TOKEN or SPARK_PRO_GATING_TOKEN is required');
		} else {
			console.warn('spark-pro-gating smoke skipped member-proof success check; set SPARK_PRO_GATING_TOKEN to enable it');
		}

		if (!process.exitCode) {
			console.log('spark-pro-gating smoke passed');
		}
	} finally {
		if (child) child.kill();
		await closeServer(mockEntitlements);
	}
}

runSmoke()
	.catch((error) => {
		fail(error instanceof Error ? error.message : String(error));
	})
	.finally(() => {
		if (startedHere) {
			setTimeout(() => process.exit(process.exitCode || 0), 250);
		}
	});
