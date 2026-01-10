/**
 * Testing Integration Service
 *
 * Runs tests as part of mission execution.
 * KISS: Simple test runner detection and result parsing.
 */

export interface TestResult {
	runner: 'vitest' | 'jest' | 'playwright' | 'unknown';
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	duration: number;  // in seconds
	coverage?: CoverageResult;
	errors: TestError[];
}

export interface CoverageResult {
	lines: number;      // percentage
	branches: number;
	functions: number;
	statements: number;
}

export interface TestError {
	testName: string;
	file: string;
	message: string;
	stack?: string;
}

export interface TestCommand {
	runner: string;
	command: string;
	args: string[];
}

// Common test runner commands
const TEST_COMMANDS: Record<string, TestCommand> = {
	'vitest': { runner: 'vitest', command: 'npx', args: ['vitest', 'run'] },
	'jest': { runner: 'jest', command: 'npx', args: ['jest', '--passWithNoTests'] },
	'playwright': { runner: 'playwright', command: 'npx', args: ['playwright', 'test'] }
};

/**
 * Detect which test runner is configured in package.json
 */
export function detectTestRunner(packageJson: {
	scripts?: Record<string, string>;
	devDependencies?: Record<string, string>;
	dependencies?: Record<string, string>;
}): TestCommand | null {
	const { scripts = {}, devDependencies = {}, dependencies = {} } = packageJson;
	const allDeps = { ...dependencies, ...devDependencies };

	// Check for vitest first (modern, preferred)
	if (allDeps['vitest'] || scripts['test']?.includes('vitest')) {
		return TEST_COMMANDS['vitest'];
	}

	// Check for jest
	if (allDeps['jest'] || scripts['test']?.includes('jest')) {
		return TEST_COMMANDS['jest'];
	}

	// Check for playwright
	if (allDeps['@playwright/test'] || scripts['test:e2e']?.includes('playwright')) {
		return { ...TEST_COMMANDS['playwright'], command: 'npx', args: ['playwright', 'test'] };
	}

	// Check if there's a test script at all
	if (scripts['test'] && scripts['test'] !== 'echo "Error: no test specified" && exit 1') {
		return { runner: 'npm', command: 'npm', args: ['run', 'test'] };
	}

	return null;
}

/**
 * Parse test output to extract results
 */
export function parseTestOutput(output: string, runner: string): TestResult {
	const result: TestResult = {
		runner: runner as TestResult['runner'],
		passed: 0,
		failed: 0,
		skipped: 0,
		total: 0,
		duration: 0,
		errors: []
	};

	// Parse vitest output
	if (runner === 'vitest') {
		// Pattern: "Tests  42 passed | 2 failed | 3 skipped (47)"
		const summaryMatch = output.match(/Tests\s+(\d+)\s+passed(?:\s*\|\s*(\d+)\s+failed)?(?:\s*\|\s*(\d+)\s+skipped)?/i);
		if (summaryMatch) {
			result.passed = parseInt(summaryMatch[1], 10) || 0;
			result.failed = parseInt(summaryMatch[2], 10) || 0;
			result.skipped = parseInt(summaryMatch[3], 10) || 0;
			result.total = result.passed + result.failed + result.skipped;
		}

		// Duration: "Duration  5.23s"
		const durationMatch = output.match(/Duration\s+([\d.]+)s/i);
		if (durationMatch) {
			result.duration = parseFloat(durationMatch[1]);
		}

		// Coverage: "All files |   85.5 |    78.2 |   92.1 |   85.5"
		const coverageMatch = output.match(/All files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/);
		if (coverageMatch) {
			result.coverage = {
				statements: parseFloat(coverageMatch[1]),
				branches: parseFloat(coverageMatch[2]),
				functions: parseFloat(coverageMatch[3]),
				lines: parseFloat(coverageMatch[4])
			};
		}
	}

	// Parse jest output
	if (runner === 'jest') {
		// Pattern: "Tests:       2 failed, 42 passed, 44 total"
		const testsMatch = output.match(/Tests:\s+(?:(\d+)\s+failed,\s+)?(?:(\d+)\s+skipped,\s+)?(\d+)\s+passed,\s+(\d+)\s+total/i);
		if (testsMatch) {
			result.failed = parseInt(testsMatch[1], 10) || 0;
			result.skipped = parseInt(testsMatch[2], 10) || 0;
			result.passed = parseInt(testsMatch[3], 10) || 0;
			result.total = parseInt(testsMatch[4], 10) || 0;
		}

		// Time: "Time:        5.23 s"
		const timeMatch = output.match(/Time:\s+([\d.]+)\s*s/i);
		if (timeMatch) {
			result.duration = parseFloat(timeMatch[1]);
		}
	}

	// Parse playwright output
	if (runner === 'playwright') {
		// Pattern: "42 passed (5.2s)"
		const passedMatch = output.match(/(\d+)\s+passed\s*\(([^)]+)\)/i);
		if (passedMatch) {
			result.passed = parseInt(passedMatch[1], 10);
			const durationStr = passedMatch[2];
			if (durationStr.includes('s')) {
				result.duration = parseFloat(durationStr);
			} else if (durationStr.includes('m')) {
				const [mins, secs] = durationStr.split('m');
				result.duration = parseInt(mins, 10) * 60 + parseFloat(secs || '0');
			}
		}

		// Failed: "2 failed"
		const failedMatch = output.match(/(\d+)\s+failed/i);
		if (failedMatch) {
			result.failed = parseInt(failedMatch[1], 10);
		}

		// Skipped: "3 skipped"
		const skippedMatch = output.match(/(\d+)\s+skipped/i);
		if (skippedMatch) {
			result.skipped = parseInt(skippedMatch[1], 10);
		}

		result.total = result.passed + result.failed + result.skipped;
	}

	// Parse error messages (common patterns)
	const errorPatterns = [
		/FAIL\s+(.+?)\n\s+✕\s+(.+?)\n\s+(.+)/g,      // jest
		/×\s+(.+?)\s+›\s+(.+?)\n(.+)/g,              // vitest
		/\d+\)\s+(.+?)\n\s+Error:\s+(.+)/g           // playwright
	];

	for (const pattern of errorPatterns) {
		let match;
		while ((match = pattern.exec(output)) !== null) {
			result.errors.push({
				file: match[1] || 'unknown',
				testName: match[2] || 'unknown',
				message: match[3] || 'Test failed'
			});
		}
	}

	return result;
}

/**
 * Generate test command string for shell execution
 */
export function getTestCommandString(testCommand: TestCommand, withCoverage = false): string {
	const args = [...testCommand.args];

	if (withCoverage) {
		if (testCommand.runner === 'vitest') {
			args.push('--coverage');
		} else if (testCommand.runner === 'jest') {
			args.push('--coverage');
		}
	}

	return `${testCommand.command} ${args.join(' ')}`;
}

/**
 * Check if tests are passing based on result
 */
export function areTestsPassing(result: TestResult): boolean {
	return result.failed === 0 && result.total > 0;
}

/**
 * Format test result for display
 */
export function formatTestReport(result: TestResult): string {
	const lines: string[] = [];

	const icon = result.failed === 0 ? '✅' : '❌';
	lines.push(`## ${icon} Test Results (${result.runner})`);
	lines.push('');

	lines.push(`| Metric | Value |`);
	lines.push(`|--------|-------|`);
	lines.push(`| Passed | ${result.passed} |`);
	lines.push(`| Failed | ${result.failed} |`);
	lines.push(`| Skipped | ${result.skipped} |`);
	lines.push(`| Total | ${result.total} |`);
	lines.push(`| Duration | ${result.duration.toFixed(2)}s |`);
	lines.push('');

	if (result.coverage) {
		lines.push('### Coverage');
		lines.push('');
		lines.push(`| Type | Coverage |`);
		lines.push(`|------|----------|`);
		lines.push(`| Lines | ${result.coverage.lines.toFixed(1)}% |`);
		lines.push(`| Branches | ${result.coverage.branches.toFixed(1)}% |`);
		lines.push(`| Functions | ${result.coverage.functions.toFixed(1)}% |`);
		lines.push(`| Statements | ${result.coverage.statements.toFixed(1)}% |`);
		lines.push('');
	}

	if (result.errors.length > 0) {
		lines.push('### Failures');
		lines.push('');
		for (const error of result.errors.slice(0, 5)) {
			lines.push(`#### ${error.testName}`);
			lines.push(`- File: \`${error.file}\``);
			lines.push(`- Error: ${error.message}`);
			lines.push('');
		}
		if (result.errors.length > 5) {
			lines.push(`_...and ${result.errors.length - 5} more failures_`);
			lines.push('');
		}
	}

	return lines.join('\n');
}

/**
 * Get recommended test strategy based on task category
 */
export function getTestStrategy(category: string): {
	runTests: boolean;
	requireCoverage: boolean;
	minCoverage: number;
	description: string;
} {
	switch (category) {
		case 'testing':
			return {
				runTests: true,
				requireCoverage: true,
				minCoverage: 80,
				description: 'Testing tasks require running and passing all tests with 80%+ coverage'
			};
		case 'deployment':
			return {
				runTests: true,
				requireCoverage: true,
				minCoverage: 70,
				description: 'Deployment requires all tests passing with 70%+ coverage'
			};
		case 'auth':
		case 'api':
			return {
				runTests: true,
				requireCoverage: false,
				minCoverage: 0,
				description: 'Critical code should have tests, but coverage not enforced'
			};
		default:
			return {
				runTests: false,
				requireCoverage: false,
				minCoverage: 0,
				description: 'Tests optional for this category'
			};
	}
}
