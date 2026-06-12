const AUTHORITY_RESIDUE_KEYS = new Set([
	'executionAuthority',
	'execution_authority',
	'harnessAuthority',
	'harness_authority',
	'governorDecision',
	'governor_decision',
	'providerAuthority',
	'provider_authority'
]);

export function stripAuthorityResidue<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((item) => stripAuthorityResidue(item)) as T;
	}
	if (!value || typeof value !== 'object') {
		return value;
	}

	const output: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
		if (AUTHORITY_RESIDUE_KEYS.has(key)) continue;
		output[key] = stripAuthorityResidue(child);
	}
	return output as T;
}
