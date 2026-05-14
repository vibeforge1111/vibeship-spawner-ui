import { z } from 'zod';
import { getTierSkills, normalizeTier, type SkillTier } from './skill-tiers';

const stringList = z.array(z.string());

function normalizeComplexity(value: unknown): unknown {
	if (typeof value !== 'string') return value;
	const normalized = value.trim().toLowerCase();
	if (['simple', 'moderate', 'complex'].includes(normalized)) return normalized;
	if (['low', 'small', 'easy', 'basic', 'tiny'].includes(normalized)) return 'simple';
	if (['medium', 'normal', 'standard', 'intermediate'].includes(normalized)) return 'moderate';
	if (['high', 'large', 'advanced', 'hard', 'difficult'].includes(normalized)) return 'complex';
	return value;
}

const taskSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	summary: z.string().optional(),
	description: z.string().optional(),
	skills: stringList.default([]),
	phase: z.number().int().positive().optional(),
	dependsOn: stringList.optional(),
	dependencies: stringList.optional(),
	targets: stringList.optional(),
	workspaceTargets: stringList.optional(),
	acceptanceCriteria: stringList.optional(),
	verificationCommands: stringList.optional(),
	verification: z
		.object({
			criteria: stringList.default([]),
			files: stringList.optional(),
			commands: stringList.optional()
		})
		.optional()
});

export const prdAnalysisResultSchema = z
	.object({
		requestId: z.string().min(1).optional(),
		success: z.literal(true),
		projectName: z.string().min(1),
		projectType: z.string().min(1).default('direct-build'),
		complexity: z.preprocess(normalizeComplexity, z.enum(['simple', 'moderate', 'complex']).default('simple')),
		infrastructure: z.object({
			needsAuth: z.boolean().default(false),
			authReason: z.string().optional(),
			needsDatabase: z.boolean().default(false),
			databaseReason: z.string().optional(),
			needsAPI: z.boolean().default(false),
			apiReason: z.string().optional()
		}).default({ needsAuth: false, needsDatabase: false, needsAPI: false }),
		techStack: z.object({
			framework: z.string().min(1).default('Existing project'),
			language: z.string().min(1).default('TypeScript or JavaScript'),
			styling: z.string().optional(),
			database: z.string().optional(),
			auth: z.string().optional(),
			deployment: z.string().optional()
		}).default({ framework: 'Existing project', language: 'TypeScript or JavaScript' }),
		tasks: z.array(taskSchema).min(1),
		skills: stringList.default([]),
		executionPrompt: z.string().min(1).optional()
	})
	.passthrough();

export type ValidPrdAnalysisResult = z.infer<typeof prdAnalysisResultSchema>;
export type StoredPrdAnalysisResult = Omit<ValidPrdAnalysisResult, 'executionPrompt'> & {
	instructionTextRedacted: true;
	metadata?: Record<string, unknown>;
};

export interface PrdSkillGateSummary {
	tier: SkillTier;
	allowedSkillCount: number;
	strippedSkillCount: number;
}

export function validatePrdAnalysisResult(requestId: string, result: unknown): ValidPrdAnalysisResult {
	const parsed = prdAnalysisResultSchema.safeParse(result);
	if (!parsed.success) {
		const details = parsed.error.issues.map((issue) => `${issue.path.join('.') || 'result'}: ${issue.message}`).join('; ');
		throw new Error(`Invalid PRD analysis result: ${details}`);
	}
	if (parsed.data.requestId && parsed.data.requestId !== requestId) {
		throw new Error(`Invalid PRD analysis result: requestId mismatch (${parsed.data.requestId} !== ${requestId})`);
	}
	return { ...parsed.data, requestId };
}

function normalizeSkillId(value: string): string {
	return value.trim();
}

function uniqueSkillIds(values: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const skillId = normalizeSkillId(value);
		if (!skillId || seen.has(skillId)) continue;
		seen.add(skillId);
		out.push(skillId);
	}
	return out;
}

function filterSkillIds(values: string[], allowedSkillIds: Set<string>): { skills: string[]; stripped: number } {
	let stripped = 0;
	const skills: string[] = [];
	for (const skillId of uniqueSkillIds(values)) {
		if (allowedSkillIds.has(skillId)) {
			skills.push(skillId);
		} else {
			stripped += 1;
		}
	}
	return { skills, stripped };
}

export async function sanitizePrdAnalysisResultForTier(
	requestId: string,
	result: unknown,
	tier: unknown
): Promise<{ result: ValidPrdAnalysisResult; summary: PrdSkillGateSummary }> {
	const normalizedTier = normalizeTier(tier);
	const allowedSkills = await getTierSkills(normalizedTier);
	const allowedSkillIds = new Set(allowedSkills.map((skill) => skill.id));
	const validated = validatePrdAnalysisResult(requestId, result) as ValidPrdAnalysisResult & {
		metadata?: unknown;
	};

	let strippedSkillCount = 0;
	const tasks = validated.tasks.map((task) => {
		const filtered = filterSkillIds(task.skills || [], allowedSkillIds);
		strippedSkillCount += filtered.stripped;
		return {
			...task,
			skills: filtered.skills
		};
	});
	const topLevel = filterSkillIds(validated.skills || [], allowedSkillIds);
	strippedSkillCount += topLevel.stripped;
	const skills = uniqueSkillIds([...topLevel.skills, ...tasks.flatMap((task) => task.skills)]);
	const metadataRecord = validated.metadata && typeof validated.metadata === 'object' && !Array.isArray(validated.metadata)
		? (validated.metadata as Record<string, unknown>)
		: {};

	return {
		result: {
			...validated,
			tasks,
			skills,
			metadata: {
				...metadataRecord,
				skillTier: normalizedTier,
				skillGate: {
					applied: true,
					tier: normalizedTier,
					allowedSkillCount: allowedSkills.length,
					strippedSkillCount
				}
			}
		},
		summary: {
			tier: normalizedTier,
			allowedSkillCount: allowedSkills.length,
			strippedSkillCount
		}
	};
}

export async function projectStoredPrdAnalysisResultForTier(
	requestId: string,
	result: unknown,
	tier: unknown
): Promise<StoredPrdAnalysisResult> {
	const sanitized = await sanitizePrdAnalysisResultForTier(requestId, result, tier);
	return projectStoredPrdAnalysisResult(requestId, sanitized.result);
}

export function projectStoredPrdAnalysisResult(requestId: string, result: unknown): StoredPrdAnalysisResult {
	const validated = validatePrdAnalysisResult(requestId, result) as ValidPrdAnalysisResult & {
		metadata?: unknown;
	};
	const { executionPrompt: _executionPrompt, metadata, ...rest } = validated;
	const metadataRecord = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
		? (metadata as Record<string, unknown>)
		: {};
	const {
		executionPrompt: _metadataExecutionPrompt,
		execution_prompt: _metadataExecutionPromptSnake,
		...safeMetadata
	} = metadataRecord;
	return {
		...rest,
		metadata: {
			...safeMetadata,
			instructionTextRedacted: true,
			instructionTextStorage: 'omitted_from_result_artifact'
		},
		instructionTextRedacted: true
	};
}
