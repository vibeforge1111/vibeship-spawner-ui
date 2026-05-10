const SAFE_TRACE_REF = /^[A-Za-z0-9:_./-]+$/;

export function normalizeTraceRef(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const traceRef = value.trim();
	if (!traceRef || traceRef.length > 180 || !SAFE_TRACE_REF.test(traceRef)) return null;
	return traceRef;
}

export function traceRefFromMissionId(missionId: string | null | undefined): string | null {
	const id = typeof missionId === 'string' ? missionId.trim() : '';
	return id ? `trace:spawner-prd:${id}` : null;
}

function traceRefFromRecord(record: Record<string, unknown>): string | null {
	return (
		normalizeTraceRef(record.traceRef) ||
		normalizeTraceRef(record.trace_ref) ||
		(record.relay && typeof record.relay === 'object'
			? traceRefFromRecord(record.relay as Record<string, unknown>)
			: null)
	);
}

export function extractTraceRef(...sources: unknown[]): string | null {
	for (const source of sources) {
		if (!source || typeof source !== 'object') continue;
		const traceRef = traceRefFromRecord(source as Record<string, unknown>);
		if (traceRef) return traceRef;
	}
	return null;
}
