type MissionNameInput = {
	content?: string | null;
	suggestedName?: string | null;
	fallback?: string;
};

const GENERIC_LEADING_WORDS = new Set([
	'a',
	'an',
	'the',
	'new',
	'tiny',
	'small',
	'quick',
	'simple',
	'polished',
	'static',
	'browser',
	'browser-playable',
	'local',
	'local-first',
	'direct',
	'advanced',
	'prd'
]);

const PRODUCT_NOUNS = [
	'app',
	'arcade',
	'arena',
	'board',
	'canvas',
	'dashboard',
	'desk',
	'game',
	'lab',
	'page',
	'panel',
	'radar',
	'room',
	'site',
	'studio',
	'system',
	'tool',
	'tracker',
	'vault',
	'website',
	'workbench'
];

function compactWhitespace(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function stripShellWords(value: string): string {
	return compactWhitespace(value)
		.replace(/^\/run\s+/i, '')
		.replace(/^(?:can\s+we|could\s+we|please|lets?|let's|i\s+want\s+to|i\s+need\s+to)\s+/i, '')
		.replace(/^(?:build|create|make|ship|scaffold|implement|turn\s+this\s+into)\s+/i, '')
		.replace(/^(?:a|an|the)\s+/i, '')
		.replace(/[.,;:!?\\/\-\u2013\u2014]+$/g, '')
		.trim();
}

function titleCaseName(value: string): string {
	return compactWhitespace(value)
		.replace(/\besthetics\b/gi, 'aesthetics')
		.replace(/\bvoxel aesthetics\b/gi, 'voxel aesthetic')
		.replace(/[-_/]+/g, ' ')
		.split(' ')
		.filter(Boolean)
		.map((word) => {
			if (/^(AI|API|CSS|GLM|HTML|JS|LLM|MCP|PRD|QA|UI|UX)$/i.test(word)) return word.toUpperCase();
			if (/^Spark$/i.test(word)) return 'Spark';
			if (/^Codex$/i.test(word)) return 'Codex';
			return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
		})
		.join(' ');
}

function trimGenericLeadingWords(value: string): string {
	const words = compactWhitespace(value).split(/\s+/).filter(Boolean);
	while (words.length > 1 && GENERIC_LEADING_WORDS.has(words[0].toLowerCase())) {
		words.shift();
	}
	return words.join(' ');
}

export function isWeakMissionName(value: string | null | undefined): boolean {
	const name = compactWhitespace(value || '');
	if (!name) return true;
	const lower = name.toLowerCase();
	const words = lower.split(/\s+/).filter(Boolean);
	return (
		name.length < 3 ||
		name.length > 72 ||
		/[.,;:]$/.test(name) ||
		/^(?:build|create|make|ship|scaffold|implement|turn|can|could|should|what|how|why|lets?|i)\b/i.test(name) ||
		/\b(?:that|which|where|with|using|for|from|into)\b/.test(lower) ||
		/\b(?:has|have|having|get|getting|stuff|thing|something)\b/.test(lower) ||
		words.length > 7 ||
		(words.length >= 5 && !PRODUCT_NOUNS.some((noun) => words.includes(noun)))
	);
}

function explicitNameFromContent(content: string): string | null {
	const patterns = [
		/\bcalled\s+["']?([A-Z0-9][A-Za-z0-9 &:'-]{2,72})["']?(?=[.,:;?]|\n|\s+(?:with|that|which|where|for|using)\b|$)/i,
		/\b(?:project|app|site|website|dashboard|tool|game)\s+["']([^"']{3,72})["']/i,
		/\bexisting shipped project\s+["']([^"']{3,72})["']/i,
		/^#\s+(.{3,72})$/m
	];
	for (const pattern of patterns) {
		const match = content.match(pattern);
		if (match?.[1]) return titleCaseName(stripShellWords(match[1]));
	}
	return null;
}

function productNameFromContent(content: string): string | null {
	const text = compactWhitespace(content);
	const voxel = text.match(/\bvoxel\s+(?:aesthetics?|esthetics?|style|visuals?)\b/i);
	if (voxel) {
		const spark = /\bspark\b/i.test(text) ? 'Spark ' : '';
		const game = /\bgame\b/i.test(text) ? 'Game' : 'Experience';
		return `${spark}Voxel Aesthetic ${game}`;
	}

	const nounPattern = PRODUCT_NOUNS.join('|');
	const patterns = [
		new RegExp(`\\b([A-Za-z0-9][A-Za-z0-9' -]{1,54}?\\b(?:${nounPattern}))\\b(?=[.,:;?!]|\\s+(?:that|which|where|with|for|to|using|and)\\b|$)`, 'i'),
		/\b(?:voxel|pixel|isometric|retro|arcade)\s+(?:aesthetic\s+)?(game|arena|arcade|lab|experience)\b/i
	];
	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (!match?.[1]) continue;
		let phrase = match[0] || match[1];
		phrase = stripShellWords(trimGenericLeadingWords(phrase));
		if (!phrase) continue;
		const words = phrase.split(/\s+/).filter(Boolean);
		if (words.length < 2) continue;
		if (/^(?:voxel|pixel|isometric|retro|arcade)\s+/.test(phrase.toLowerCase()) && !/\b(?:game|arena|arcade|lab|experience)\b/i.test(phrase)) {
			phrase = `${phrase} Game`;
		}
		return titleCaseName(phrase);
	}

	return null;
}

function cleanedSuggestedName(value: string | null | undefined): string | null {
	if (!value) return null;
	const cleaned = titleCaseName(trimGenericLeadingWords(stripShellWords(value)));
	return cleaned || null;
}

export function resolveMissionName(input: MissionNameInput): string {
	const content = input.content || '';
	const suggestedRaw = compactWhitespace(input.suggestedName || '');
	const sparseUnderstandingRequest = /^\s*did\s+you\s+understand\s+what\s+i\s+said\s*$/i;
	if (sparseUnderstandingRequest.test(content) || sparseUnderstandingRequest.test(suggestedRaw)) {
		return 'did you understand what i said';
	}

	const explicit = explicitNameFromContent(content);
	if (explicit && !isWeakMissionName(explicit)) return explicit;

	const suggested = cleanedSuggestedName(input.suggestedName);
	if (suggested && !isWeakMissionName(suggested)) return suggested;

	const product = productNameFromContent(content);
	if (product && !isWeakMissionName(product)) return product;

	if (suggested) {
		const words = suggested
			.split(/\s+/)
			.filter((word) => !GENERIC_LEADING_WORDS.has(word.toLowerCase()))
			.slice(0, 5)
			.join(' ');
		if (words) return titleCaseName(words);
	}

	return input.fallback || 'Spark Mission';
}

export function formatMissionNamingGuidance(): string {
	return [
		'Project naming contract:',
		'- Output projectName as a polished human product/mission name, not a copied prompt fragment.',
		'- Prefer 2-5 words, Title Case, no trailing punctuation, no "can we", "build", "that has", or raw clauses.',
		'- Preserve explicit names from phrases like "called X" or existing shipped project "X".',
		'- If the name hint looks weak, infer the name from what is being built.'
	].join('\n');
}
