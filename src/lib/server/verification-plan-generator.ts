import type { MissionProjectKind, MissionSizeClassification } from './mission-size-classifier';

export interface VerificationPlan {
	projectKind: MissionProjectKind;
	depth: MissionSizeClassification['verificationDepth'];
	acceptanceCriteria: string[];
	commands: string[];
	notes: string[];
}

interface VerificationPlanOptions {
	targetFolder?: string;
	projectName?: string;
}

const BASE_CRITERIA = [
	'The requested surface opens without runtime errors.',
	'The requested user workflow can be completed manually.',
	'The final handoff explains how to verify the result.'
];

function unique(values: string[]): string[] {
	return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function folderPath(options: VerificationPlanOptions): string {
	return options.targetFolder?.trim() || '<target-folder>';
}

function staticAppPlan(options: VerificationPlanOptions): VerificationPlan {
	const target = folderPath(options);
	return {
		projectKind: 'static-app',
		depth: 'standard',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'The project keeps the requested no-build static file shape.',
			'Browser state persists across refresh when persistence was requested.'
		],
		commands: [
			`Test-Path '${target}\\index.html'`,
			`Get-ChildItem '${target}' | Select-Object -ExpandProperty Name`,
			`node --check '${target}\\app.js'`
		],
		notes: ['Add a browser or DOM smoke test when the app has interaction or persistence.']
	};
}

function threejsPlan(options: VerificationPlanOptions): VerificationPlan {
	const target = folderPath(options);
	return {
		projectKind: 'threejs-app',
		depth: 'deep',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'The 3D canvas renders nonblank pixels on desktop and mobile sizes.',
			'The WebGL fallback path is visible when WebGL is unavailable.',
			'Interactive controls update the scene and survive refresh when persistence was requested.'
		],
		commands: [
			`Test-Path '${target}\\index.html'`,
			`node --check '${target}\\app.js'`,
			'Run a headless browser smoke test for nonblank canvas pixels, controls, mobile layout, and fallback mode.'
		],
		notes: ['Prefer pixel checks over only checking that the page loaded.']
	};
}

function dashboardPlan(): VerificationPlan {
	return {
		projectKind: 'dashboard',
		depth: 'standard',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'Metric cards, tables, filters, and fallback states render from the data loader.',
			'Sample data is clearly marked when live data is unavailable.'
		],
		commands: ['npm run check', 'npm run test:run', 'Run a browser smoke test for the dashboard route.'],
		notes: ['Include aggregation tests for every metric shown above the fold.']
	};
}

function repoFeaturePlan(): VerificationPlan {
	return {
		projectKind: 'repo-feature',
		depth: 'standard',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'The changed route, service, or component has focused unit coverage.',
			'The existing app still typechecks and builds.'
		],
		commands: ['npm run check', 'npm run test:run', 'npm run build'],
		notes: ['Add a targeted route or component smoke when the change is user visible.']
	};
}

function backendPlan(): VerificationPlan {
	return {
		projectKind: 'backend-api',
		depth: 'deep',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'API validation rejects malformed input and accepts the expected happy path.',
			'Persistence or file writes are verified without touching unrelated data.'
		],
		commands: ['npm run check', 'npm run test:run', 'Run focused API request tests for success and failure cases.'],
		notes: ['Cover auth, validation, and soft failure behavior when those paths exist.']
	};
}

function domainChipPlan(options: VerificationPlanOptions): VerificationPlan {
	const target = folderPath(options);
	return {
		projectKind: 'domain-chip',
		depth: 'deep',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'spark-chip.json declares the requested hook contract.',
			'Every declared hook has at least one unit test and one sample invocation.'
		],
		commands: [
			`Test-Path '${target}\\spark-chip.json'`,
			'python -m pytest',
			'Run hook smoke tests for evaluate, suggest, packets, and watchtower when declared.'
		],
		notes: ['Inspect an existing chip pattern before writing new hook shapes.']
	};
}

function multiSystemPlan(): VerificationPlan {
	return {
		projectKind: 'multi-system',
		depth: 'deep',
		acceptanceCriteria: [
			...BASE_CRITERIA,
			'Events move through Telegram, Kanban, Canvas, Trace, and mission execution with the same mission ID.',
			'Progress, completion, cancellation, and failure states stay aligned across surfaces.'
		],
		commands: [
			'npm run check',
			'npm run test:run',
			'npm run build',
			'Run an end-to-end smoke mission and inspect Kanban, Canvas, Trace, and Telegram output.'
		],
		notes: ['Record mission ID, pipeline ID, request ID, and event source in the smoke evidence.']
	};
}

function generalPlan(): VerificationPlan {
	return {
		projectKind: 'general',
		depth: 'light',
		acceptanceCriteria: BASE_CRITERIA,
		commands: ['Run the smallest local check that proves the changed behavior.'],
		notes: ['Prefer one focused check over a broad unrelated test run.']
	};
}

export function generateVerificationPlan(
	classification: Pick<MissionSizeClassification, 'projectKind' | 'verificationDepth'>,
	options: VerificationPlanOptions = {}
): VerificationPlan {
	const plan =
		classification.projectKind === 'static-app'
			? staticAppPlan(options)
			: classification.projectKind === 'threejs-app'
				? threejsPlan(options)
				: classification.projectKind === 'dashboard'
					? dashboardPlan()
					: classification.projectKind === 'repo-feature'
						? repoFeaturePlan()
						: classification.projectKind === 'backend-api'
							? backendPlan()
							: classification.projectKind === 'domain-chip'
								? domainChipPlan(options)
								: classification.projectKind === 'multi-system'
									? multiSystemPlan()
									: generalPlan();

	return {
		...plan,
		depth: classification.verificationDepth,
		acceptanceCriteria: unique(plan.acceptanceCriteria),
		commands: unique(plan.commands),
		notes: unique(plan.notes)
	};
}

export function formatVerificationPlanGuidance(plan: VerificationPlan): string {
	return [
		'Verification planning guidance:',
		`- Project kind: ${plan.projectKind}`,
		`- Verification depth: ${plan.depth}`,
		'- Use these as starting points, then adapt to the exact project files and stack.',
		'- Acceptance signals:',
		...plan.acceptanceCriteria.map((criterion) => `  - ${criterion}`),
		'- Useful checks:',
		...plan.commands.map((command) => `  - ${command}`),
		'- Notes:',
		...plan.notes.map((note) => `  - ${note}`)
	].join('\n');
}
