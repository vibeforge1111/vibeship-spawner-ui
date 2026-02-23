export interface SentinelDispatchAction {
	kind: 'pr_review' | 'issue_followup';
	id: string;
	priority: string;
	title: string;
	reasons: string[];
	linked_issues?: string[];
	repro_steps?: string[];
	fix_plan?: string[];
	url?: string;
	[key: string]: unknown;
}

export interface SentinelDispatchPayload {
	source: 'spark-pr-sentinel';
	generated_at: string;
	summary: Record<string, unknown>;
	actions: SentinelDispatchAction[];
}

export function validateSentinelDispatchPayload(payload: unknown): string[] {
	const errors: string[] = [];
	if (!payload || typeof payload !== 'object') {
		return ['payload must be an object'];
	}

	const record = payload as Record<string, unknown>;
	if (record.source !== 'spark-pr-sentinel') {
		errors.push("source must be 'spark-pr-sentinel'");
	}
	if (typeof record.generated_at !== 'string' || !record.generated_at.trim()) {
		errors.push('generated_at must be a non-empty string');
	}
	if (!record.summary || typeof record.summary !== 'object' || Array.isArray(record.summary)) {
		errors.push('summary must be an object');
	}

	if (!Array.isArray(record.actions)) {
		errors.push('actions must be an array');
		return errors;
	}

	record.actions.forEach((action, index) => {
		if (!action || typeof action !== 'object') {
			errors.push(`actions[${index}] must be an object`);
			return;
		}
		const item = action as Record<string, unknown>;
		if (item.kind !== 'pr_review' && item.kind !== 'issue_followup') {
			errors.push(`actions[${index}].kind must be pr_review|issue_followup`);
		}
		if (typeof item.id !== 'string' || !item.id.trim()) {
			errors.push(`actions[${index}].id must be a non-empty string`);
		}
		if (typeof item.priority !== 'string' || !item.priority.trim()) {
			errors.push(`actions[${index}].priority must be a non-empty string`);
		}
		if (typeof item.title !== 'string' || !item.title.trim()) {
			errors.push(`actions[${index}].title must be a non-empty string`);
		}
		if (!Array.isArray(item.reasons)) {
			errors.push(`actions[${index}].reasons must be an array`);
		}
	});

	return errors;
}

export function normalizeSentinelDispatchPayload(payload: SentinelDispatchPayload): SentinelDispatchPayload {
	return {
		source: 'spark-pr-sentinel',
		generated_at: payload.generated_at,
		summary: payload.summary || {},
		actions: payload.actions.map((action) => ({
			...action,
			id: action.id.trim(),
			priority: action.priority.trim(),
			title: action.title.trim(),
			reasons: action.reasons.map((reason) => String(reason).trim()).filter(Boolean)
		}))
	};
}
