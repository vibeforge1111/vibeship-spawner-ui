export type MissionBuildSize = 'tiny' | 'small' | 'standard' | 'large' | 'system';

export type MissionProjectKind =
	| 'static-app'
	| 'threejs-app'
	| 'dashboard'
	| 'repo-feature'
	| 'domain-chip'
	| 'backend-api'
	| 'multi-system'
	| 'general';

export interface MissionSizeClassification {
	size: MissionBuildSize;
	projectKind: MissionProjectKind;
	suggestedTaskRange: [number, number];
	verificationDepth: 'light' | 'standard' | 'deep';
	reasons: string[];
}

interface Rule {
	kind?: MissionProjectKind;
	score: number;
	reason: string;
	pattern: RegExp;
}

const RULES: Rule[] = [
	{ kind: 'domain-chip', score: 6, reason: 'domain chip package or hook contract', pattern: /\bdomain[-\s]?chip\b|\bspark-chip\.json\b|\bhooks?\b/i },
	{ kind: 'multi-system', score: 6, reason: 'multi-system Spark integration', pattern: /\btelegram\b|\bcanvas\b|\bkanban\b|\bmission control\b|\btrace\b|\bspawner-ui\b/i },
	{ kind: 'backend-api', score: 5, reason: 'backend or API surface', pattern: /\bbackend\b|\bapi\b|\bendpoints?\b|\bserver\b|\bdatabase\b|\bauth\b|\blogin\b|\bpostgres\b|\bsupabase\b/i },
	{ kind: 'threejs-app', score: 4, reason: '3D or WebGL experience', pattern: /\bthree\.?js\b|\bwebgl\b|\b3d\b|\bshader\b|\bscene\b|\bparticles?\b/i },
	{ kind: 'dashboard', score: 4, reason: 'dashboard or monitoring surface', pattern: /\bdashboard\b|\bmetrics?\b|\bmonitoring\b|\banalytics\b|\btable\b|\bcharts?\b/i },
	{ kind: 'repo-feature', score: 4, reason: 'existing repository feature work', pattern: /\binside\s+(?:spawner-ui|repo|repository|codebase)\b|\bexisting\s+(?:repo|repository|codebase)\b|\bnew route\b|\bserver route\b|\bcomponents?\b|\bservice\b|\bunit test\b/i },
	{ kind: 'static-app', score: 3, reason: 'explicit static app constraints', pattern: /\bvanilla[-\s]?js\b|\bno build step\b|\bindex\.html\b|\bstyles\.css\b|\bapp\.js\b/i },
	{ score: 3, reason: 'explicit persistence requirement', pattern: /\blocalStorage\b|\bpersist\b|\bsaved?\b/i },
	{ score: 3, reason: 'explicit verification or smoke test requirement', pattern: /\bsmoke test\b|\bverification\b|\btest commands?\b|\btests pass\b/i },
	{ score: 2, reason: 'rich interaction surface', pattern: /\bdrag\b|\bdrop\b|\bcontrols?\b|\bfilters?\b|\bforms?\b|\bworkflow\b|\beditor\b/i },
	{ score: 2, reason: 'design quality requirement', pattern: /\bresponsive\b|\bmobile\b|\bdark\b|\bpolish\b|\bdesign\b|\baccessibility\b/i }
];

function clampRange(size: MissionBuildSize): [number, number] {
	switch (size) {
		case 'tiny':
			return [2, 3];
		case 'small':
			return [3, 5];
		case 'standard':
			return [5, 8];
		case 'large':
			return [8, 14];
		case 'system':
			return [10, 18];
	}
}

function verificationDepth(size: MissionBuildSize): MissionSizeClassification['verificationDepth'] {
	if (size === 'tiny' || size === 'small') return 'light';
	if (size === 'standard') return 'standard';
	return 'deep';
}

function chooseSize(score: number, wordCount: number): MissionBuildSize {
	if (score >= 14 || wordCount >= 180) return 'system';
	if (score >= 10 || wordCount >= 110) return 'large';
	if (score >= 6 || wordCount >= 55) return 'standard';
	if (score >= 3 || wordCount >= 18) return 'small';
	return 'tiny';
}

function chooseKind(matches: Array<Rule & { matched: true }>): MissionProjectKind {
	const kindScores = new Map<MissionProjectKind, number>();
	for (const match of matches) {
		if (!match.kind) continue;
		kindScores.set(match.kind, (kindScores.get(match.kind) || 0) + match.score);
	}
	const sorted = [...kindScores.entries()].sort((a, b) => b[1] - a[1]);
	return sorted[0]?.[0] || 'general';
}

function countMultiSystemSignals(text: string): number {
	const signals = ['telegram', 'canvas', 'kanban', 'trace', 'mission control', 'spawner-ui', 'provider execution'];
	const lower = text.toLowerCase();
	return signals.filter((signal) => lower.includes(signal)).length;
}

export function classifyMissionSize(brief: string): MissionSizeClassification {
	const normalized = brief.trim();
	const words = normalized.split(/\s+/).filter(Boolean);
	const matches = RULES.filter((rule): rule is Rule & { matched: true } => rule.pattern.test(normalized));
	const score = matches.reduce((total, rule) => total + rule.score, 0);
	const projectKind = chooseKind(matches);
	const multiSystemSignals = countMultiSystemSignals(normalized);
	const size =
		projectKind === 'multi-system' && multiSystemSignals >= 3
			? 'system'
			: projectKind === 'domain-chip' && score >= 9
				? 'large'
				: chooseSize(score, words.length);

	return {
		size,
		projectKind,
		suggestedTaskRange: clampRange(size),
		verificationDepth: verificationDepth(size),
		reasons: [...new Set(matches.map((rule) => rule.reason))].slice(0, 5)
	};
}

export function formatMissionSizeGuidance(classification: MissionSizeClassification): string {
	const [minTasks, maxTasks] = classification.suggestedTaskRange;
	const lines = [
		'Mission size guidance:',
		`- Size: ${classification.size}`,
		`- Project kind: ${classification.projectKind}`,
		`- Suggested task range: ${minTasks}-${maxTasks}`,
		`- Verification depth: ${classification.verificationDepth}`,
		'- Use this as a planning prior, not a hard cap. Adjust if the brief clearly needs more or fewer tasks.'
	];
	if (classification.reasons.length > 0) {
		lines.push(`- Detected signals: ${classification.reasons.join(', ')}`);
	}
	return lines.join('\n');
}
