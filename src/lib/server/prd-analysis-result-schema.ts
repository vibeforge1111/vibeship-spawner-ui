import { z } from 'zod';

const stringList = z.array(z.string());

const taskSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	summary: z.string().optional(),
	description: z.string().optional(),
	skills: stringList.default([]),
	phase: z.number().int().positive().optional(),
	dependsOn: stringList.optional(),
	dependencies: stringList.optional(),
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
		complexity: z.enum(['simple', 'moderate', 'complex']).default('simple'),
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
		executionPrompt: z.string().min(1)
	})
	.passthrough();

export type ValidPrdAnalysisResult = z.infer<typeof prdAnalysisResultSchema>;

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
