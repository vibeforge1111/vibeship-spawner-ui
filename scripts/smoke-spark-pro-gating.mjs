const DEFAULT_BASE_URL = 'http://127.0.0.1:5173';
const PRO_FEATURES = new Set(['spark_pro', 'drop.skills']);

function configured(value) {
	return typeof value === 'string' ? value.trim() : '';
}

function boolEnv(value) {
	return ['1', 'true', 'yes', 'enforce', 'strict'].includes(configured(value).toLowerCase());
}

function joinUrl(baseUrl, path) {
	return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function authHeaders() {
	const headers = {};
	const cookie = configured(process.env.SPARK_PRO_COOKIE);
	const authorization =
		configured(process.env.SPARK_PRO_AUTHORIZATION) ||
		configured(process.env.SPARK_PRO_AUTH_HEADER) ||
		(configured(process.env.SPARK_PRO_BEARER_TOKEN)
			? `Bearer ${configured(process.env.SPARK_PRO_BEARER_TOKEN)}`
			: '');

	if (cookie) headers.cookie = cookie;
	if (authorization) headers.authorization = authorization;
	return headers;
}

async function readResponse(response) {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text.slice(0, 500);
	}
}

async function checkSkill(baseUrl, skillId, headers = {}) {
	const response = await fetch(joinUrl(baseUrl, `/api/h70-skills/${encodeURIComponent(skillId)}`), {
		headers
	});
	return {
		status: response.status,
		ok: response.ok,
		body: await readResponse(response)
	};
}

function hasProFeature(body) {
	const features = Array.isArray(body?.features) ? body.features : [];
	return features.some((feature) => typeof feature === 'string' && PRO_FEATURES.has(feature));
}

async function checkDirectEntitlements(baseUrl, headers) {
	const response = await fetch(joinUrl(baseUrl, '/api/member/entitlements'), { headers });
	const body = await readResponse(response);
	return {
		status: response.status,
		ok: response.ok,
		hasProFeature: response.ok && hasProFeature(body),
		body
	};
}

function pass(name, details = {}) {
	return { name, status: 'pass', ...details };
}

function warn(name, reason, details = {}) {
	return { name, status: 'warn', reason, ...details };
}

function fail(name, reason, details = {}) {
	return { name, status: 'fail', reason, ...details };
}

async function main() {
	const spawnerBaseUrl = configured(process.env.SPAWNER_SMOKE_BASE_URL) || DEFAULT_BASE_URL;
	const sparkProBaseUrl =
		configured(process.env.SPAWNER_SPARK_PRO_API_BASE_URL) ||
		configured(process.env.SPARK_PRO_API_BASE_URL) ||
		configured(process.env.SPARK_PRO_BASE_URL);
	const freeSkill = configured(process.env.SPAWNER_SMOKE_FREE_SKILL) || 'frontend-engineer';
	const proSkill = configured(process.env.SPAWNER_SMOKE_PRO_SKILL) || 'usage-metering-entitlements';
	const expectEnforcement =
		boolEnv(process.env.SPAWNER_EXPECT_PRO_ENFORCEMENT) ||
		boolEnv(process.env.SPAWNER_PRO_SKILL_ENFORCEMENT) ||
		boolEnv(process.env.SPARK_PRO_SKILL_ENFORCEMENT);
	const requireAuthSmoke = boolEnv(process.env.SPAWNER_REQUIRE_PRO_AUTH_SMOKE);
	const headers = authHeaders();
	const hasAuth = Boolean(headers.cookie || headers.authorization);
	const checks = [];

	try {
		const free = await checkSkill(spawnerBaseUrl, freeSkill);
		checks.push(
			free.ok
				? pass('free_skill_public', { skillId: freeSkill, statusCode: free.status })
				: fail('free_skill_public', 'free starter skill did not load', {
						skillId: freeSkill,
						statusCode: free.status,
						body: free.body
					})
		);
	} catch (error) {
		checks.push(fail('free_skill_public', error.message, { skillId: freeSkill }));
	}

	try {
		const proNoAuth = await checkSkill(spawnerBaseUrl, proSkill);
		const locked = [401, 403, 503].includes(proNoAuth.status);
		if (expectEnforcement) {
			checks.push(
				locked
					? pass('pro_skill_locked_without_auth', { skillId: proSkill, statusCode: proNoAuth.status })
					: fail('pro_skill_locked_without_auth', 'Pro skill loaded without member proof while enforcement was expected', {
							skillId: proSkill,
							statusCode: proNoAuth.status,
							body: proNoAuth.body
						})
			);
		} else {
			checks.push(
				locked
					? pass('pro_skill_locked_without_auth', { skillId: proSkill, statusCode: proNoAuth.status })
					: warn('pro_skill_locked_without_auth', 'Pro enforcement appears off on this target', {
							skillId: proSkill,
							statusCode: proNoAuth.status
						})
			);
		}
	} catch (error) {
		checks.push(fail('pro_skill_locked_without_auth', error.message, { skillId: proSkill }));
	}

	if (hasAuth) {
		try {
			const proWithAuth = await checkSkill(spawnerBaseUrl, proSkill, headers);
			checks.push(
				proWithAuth.ok
					? pass('pro_skill_loads_with_member_auth', { skillId: proSkill, statusCode: proWithAuth.status })
					: fail('pro_skill_loads_with_member_auth', 'authenticated member could not load Pro skill through Spawner', {
							skillId: proSkill,
							statusCode: proWithAuth.status,
							body: proWithAuth.body
						})
			);
		} catch (error) {
			checks.push(fail('pro_skill_loads_with_member_auth', error.message, { skillId: proSkill }));
		}
	} else {
		const result = warn('pro_skill_loads_with_member_auth', 'set SPARK_PRO_COOKIE or SPARK_PRO_AUTHORIZATION to run this live check', {
			skillId: proSkill
		});
		checks.push(requireAuthSmoke ? { ...result, status: 'fail' } : result);
	}

	if (sparkProBaseUrl && hasAuth) {
		try {
			const entitlements = await checkDirectEntitlements(sparkProBaseUrl, headers);
			checks.push(
				entitlements.hasProFeature
					? pass('spark_pro_entitlements_contract', { statusCode: entitlements.status })
					: fail('spark_pro_entitlements_contract', 'Spark Pro did not return spark_pro or drop.skills', {
							statusCode: entitlements.status,
							body: entitlements.body
						})
			);
		} catch (error) {
			checks.push(fail('spark_pro_entitlements_contract', error.message));
		}
	} else {
		const missing = [];
		if (!sparkProBaseUrl) missing.push('SPARK_PRO_API_BASE_URL');
		if (!hasAuth) missing.push('SPARK_PRO_COOKIE or SPARK_PRO_AUTHORIZATION');
		const result = warn('spark_pro_entitlements_contract', `missing ${missing.join(', ')}`);
		checks.push(requireAuthSmoke ? { ...result, status: 'fail' } : result);
	}

	const failed = checks.filter((check) => check.status === 'fail');
	const report = {
		ok: failed.length === 0,
		spawnerBaseUrl,
		sparkProBaseUrl: sparkProBaseUrl || null,
		freeSkill,
		proSkill,
		expectEnforcement,
		authProvided: hasAuth,
		checks
	};

	console.log(JSON.stringify(report, null, 2));
	if (failed.length) process.exit(1);
}

main().catch((error) => {
	console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
	process.exit(1);
});
