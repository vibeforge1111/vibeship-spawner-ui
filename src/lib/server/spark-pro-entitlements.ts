import { env } from '$env/dynamic/private';

const ACCEPTED_SKILL_FEATURES = new Set(['spark_pro', 'drop.skills']);
const DEFAULT_SPARK_PRO_BASE_URL = 'https://pro.sparkswarm.ai';

export type SparkProEntitlementVerdict = 'ok' | 'missing' | 'unauthorized' | 'forbidden' | 'unavailable';

export interface SparkProEntitlementEnv {
	[key: string]: string | undefined;
	SPARK_PRO_API_BASE_URL?: string;
	SPARK_PRO_BASE_URL?: string;
}

export function sparkProBaseUrl(envRecord: SparkProEntitlementEnv = env): string {
	return (
		process.env.SPARK_PRO_API_BASE_URL ||
		process.env.SPARK_PRO_BASE_URL ||
		envRecord.SPARK_PRO_API_BASE_URL ||
		envRecord.SPARK_PRO_BASE_URL ||
		DEFAULT_SPARK_PRO_BASE_URL
	).replace(/\/+$/, '');
}

export function sparkProProofHeaders(request: Request): Headers | null {
	const headers = new Headers();
	const authorization = request.headers.get('authorization');
	if (authorization?.match(/^Bearer\s+(.+)$/i)) {
		headers.set('authorization', authorization);
		return headers;
	}

	const cookie = request.headers.get('cookie') || '';
	const sparkProCookie = cookie
		.split(';')
		.map((part) => part.trim())
		.find((part) => part.startsWith('spark_pro_session='));
	if (sparkProCookie) {
		headers.set('cookie', sparkProCookie);
		return headers;
	}

	return null;
}

export async function verifySparkProSkillAccess(
	request: Request,
	options: {
		envRecord?: SparkProEntitlementEnv;
		fetchImpl?: typeof fetch;
	} = {}
): Promise<SparkProEntitlementVerdict> {
	const proofHeaders = sparkProProofHeaders(request);
	if (!proofHeaders) return 'missing';

	const baseUrl = sparkProBaseUrl(options.envRecord);
	const fetchImpl = options.fetchImpl || fetch;
	try {
		const response = await fetchImpl(new URL('/api/member/entitlements', baseUrl), {
			method: 'GET',
			headers: proofHeaders
		});
		if (response.status === 401) return 'unauthorized';
		if (!response.ok) return 'unavailable';

		const body = (await response.json()) as { features?: unknown };
		const features = Array.isArray(body.features) ? body.features : [];
		return features.some((feature) => typeof feature === 'string' && ACCEPTED_SKILL_FEATURES.has(feature))
			? 'ok'
			: 'forbidden';
	} catch {
		return 'unavailable';
	}
}
