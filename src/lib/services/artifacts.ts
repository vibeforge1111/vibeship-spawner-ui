/**
 * Artifact Tracking Service
 *
 * Tracks what each task produces, verifies expected outputs.
 * KISS: Simple category-based expectations.
 */

export interface ExpectedArtifacts {
	files: string[];        // Glob patterns for expected files
	exports?: string[];     // Expected exports (for code files)
	description: string;
}

export interface ArtifactVerification {
	category: string;
	expected: string[];
	found: string[];
	missing: string[];
	score: number;  // 0-100 based on coverage
}

// Category-based artifact expectations
const CATEGORY_ARTIFACTS: Record<string, ExpectedArtifacts> = {
	'auth': {
		files: [
			'**/auth/**/*.ts',
			'**/auth/**/*.tsx',
			'**/middleware*.ts',
			'**/*session*.ts',
			'**/*login*.tsx'
		],
		description: 'Authentication files: auth directory, middleware, session handling'
	},
	'database': {
		files: [
			'**/db/**/*.ts',
			'**/schema*.ts',
			'**/drizzle.config.ts',
			'**/migrations/**/*.sql',
			'**/prisma/schema.prisma'
		],
		description: 'Database files: schema, config, migrations'
	},
	'api': {
		files: [
			'**/api/**/*.ts',
			'**/routes/**/*.ts',
			'**/server/**/*.ts',
			'**/*endpoint*.ts',
			'**/*handler*.ts'
		],
		description: 'API files: routes, handlers, endpoints'
	},
	'testing': {
		files: [
			'**/*.test.ts',
			'**/*.test.tsx',
			'**/*.spec.ts',
			'**/*.spec.tsx',
			'**/vitest.config.ts',
			'**/jest.config.ts',
			'**/playwright.config.ts'
		],
		description: 'Test files: test specs, config files'
	},
	'deployment': {
		files: [
			'.github/workflows/*.yml',
			'.github/workflows/*.yaml',
			'Dockerfile',
			'docker-compose.yml',
			'docker-compose.yaml',
			'vercel.json',
			'netlify.toml'
		],
		description: 'Deployment files: CI/CD, Docker, platform configs'
	},
	'frontend': {
		files: [
			'**/components/**/*.tsx',
			'**/components/**/*.svelte',
			'**/pages/**/*.tsx',
			'**/app/**/*.tsx',
			'**/routes/**/*.svelte'
		],
		description: 'Frontend files: components, pages, routes'
	},
	'styling': {
		files: [
			'**/globals.css',
			'**/tailwind.config.ts',
			'**/tailwind.config.js',
			'**/*.module.css',
			'**/styles/**/*.css'
		],
		description: 'Styling files: CSS, Tailwind config'
	},
	'config': {
		files: [
			'package.json',
			'tsconfig.json',
			'.env.example',
			'.env.local',
			'next.config.js',
			'next.config.ts',
			'svelte.config.js',
			'vite.config.ts'
		],
		description: 'Configuration files: package, TypeScript, framework config'
	}
};

/**
 * Get expected artifacts for a task category
 */
export function getExpectedArtifacts(category: string): ExpectedArtifacts | null {
	return CATEGORY_ARTIFACTS[category] || null;
}

/**
 * Get all artifact categories
 */
export function getAllArtifactCategories(): string[] {
	return Object.keys(CATEGORY_ARTIFACTS);
}

/**
 * Infer artifact category from task text
 */
export function inferArtifactCategory(taskTitle: string, taskDescription: string): string | null {
	const text = `${taskTitle} ${taskDescription}`.toLowerCase();

	if (text.includes('auth') || text.includes('login') || text.includes('session') || text.includes('oauth')) {
		return 'auth';
	}
	if (text.includes('database') || text.includes('schema') || text.includes('migration') || text.includes('drizzle') || text.includes('prisma')) {
		return 'database';
	}
	if (text.includes('api') || text.includes('endpoint') || text.includes('route') || text.includes('handler')) {
		return 'api';
	}
	if (text.includes('test') || text.includes('spec') || text.includes('coverage') || text.includes('vitest') || text.includes('jest')) {
		return 'testing';
	}
	if (text.includes('deploy') || text.includes('ci/cd') || text.includes('docker') || text.includes('github action')) {
		return 'deployment';
	}
	if (text.includes('component') || text.includes('page') || text.includes('ui') || text.includes('frontend') || text.includes('react') || text.includes('svelte')) {
		return 'frontend';
	}
	if (text.includes('style') || text.includes('css') || text.includes('tailwind') || text.includes('design')) {
		return 'styling';
	}
	if (text.includes('config') || text.includes('setup') || text.includes('install') || text.includes('initialize')) {
		return 'config';
	}

	return null;
}

/**
 * Create artifact verification result
 * Note: In a real implementation, this would use glob to check the file system
 * For now, we track what's reported and provide structure for verification
 */
export function createArtifactVerification(
	category: string,
	foundFiles: string[]
): ArtifactVerification {
	const expected = CATEGORY_ARTIFACTS[category];
	if (!expected) {
		return {
			category,
			expected: [],
			found: foundFiles,
			missing: [],
			score: foundFiles.length > 0 ? 100 : 0
		};
	}

	// For now, we can't actually check glob patterns without file system access
	// So we'll estimate based on what's reported
	const score = foundFiles.length > 0 ? Math.min(100, foundFiles.length * 25) : 0;

	return {
		category,
		expected: expected.files,
		found: foundFiles,
		missing: [], // Would be populated by actual file system check
		score
	};
}

/**
 * Parse file paths from task completion logs
 */
export function parseFilesFromLogs(logs: Array<{ message: string }>): string[] {
	const files: string[] = [];
	const filePatterns = [
		/created?\s+(?:file\s+)?[`"']?([^`"'\s]+\.[a-z]{2,4})[`"']?/gi,
		/wrote?\s+(?:to\s+)?[`"']?([^`"'\s]+\.[a-z]{2,4})[`"']?/gi,
		/modified?\s+[`"']?([^`"'\s]+\.[a-z]{2,4})[`"']?/gi,
		/updated?\s+[`"']?([^`"'\s]+\.[a-z]{2,4})[`"']?/gi,
		/generated?\s+[`"']?([^`"'\s]+\.[a-z]{2,4})[`"']?/gi,
	];

	for (const log of logs) {
		for (const pattern of filePatterns) {
			const matches = log.message.matchAll(pattern);
			for (const match of matches) {
				if (match[1] && !files.includes(match[1])) {
					files.push(match[1]);
				}
			}
		}
	}

	return files;
}

/**
 * Format artifact report
 */
export function formatArtifactReport(verifications: ArtifactVerification[]): string {
	const lines: string[] = [];

	lines.push('## Artifact Tracking Report');
	lines.push('');

	if (verifications.length === 0) {
		lines.push('No artifacts tracked.');
		return lines.join('\n');
	}

	const avgScore = verifications.reduce((sum, v) => sum + v.score, 0) / verifications.length;
	lines.push(`**Average Coverage:** ${Math.round(avgScore)}%`);
	lines.push('');

	lines.push('| Category | Files Found | Score |');
	lines.push('|----------|-------------|-------|');

	for (const v of verifications) {
		const icon = v.score >= 75 ? '✅' : v.score >= 50 ? '⚠️' : '❌';
		lines.push(`| ${v.category} | ${v.found.length} | ${icon} ${v.score}% |`);
	}

	lines.push('');

	// List found files by category
	for (const v of verifications) {
		if (v.found.length > 0) {
			lines.push(`### ${v.category}`);
			for (const file of v.found.slice(0, 10)) {
				lines.push(`- \`${file}\``);
			}
			if (v.found.length > 10) {
				lines.push(`- _...and ${v.found.length - 10} more_`);
			}
			lines.push('');
		}
	}

	return lines.join('\n');
}
