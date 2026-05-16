const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
const KNOWN_ACRONYMS = new Map([
	['api', 'API'],
	['cli', 'CLI'],
	['h70', 'H70'],
	['mcp', 'MCP'],
	['prd', 'PRD'],
	['qa', 'QA'],
	['tg', 'TG'],
	['ui', 'UI']
]);

function titleCaseWord(word: string, index: number): string {
	const lower = word.toLowerCase();
	const acronym = KNOWN_ACRONYMS.get(lower);
	if (acronym) return acronym;
	if (index > 0 && SMALL_WORDS.has(lower)) return lower;
	if (/[A-Z]/.test(word.slice(1)) || /^[A-Z0-9]{2,}$/.test(word)) return word;
	return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function titleCasePhrase(value: string): string {
	return value
		.split(/\s+/)
		.filter(Boolean)
		.map((word, index) => word.split('-').map((part, partIndex) => titleCaseWord(part, index + partIndex)).join('-'))
		.join(' ');
}

export function polishMissionTitleForDisplay(value: string | null | undefined): string {
	const raw = (value || '').trim();
	if (!raw) return 'Untitled Mission';

	const cleaned = raw
		.replace(/^spark run:\s*/i, '')
		.replace(/^through\s+spawner\s+mission\s+control:\s*/i, '')
		.replace(/^(mission-[a-z0-9-]+)$/i, (_, id: string) => id.replace(/-/g, ' '))
		.replace(/\s+plan\s+and\s+build\s*$/i, '')
		.replace(/\s+/g, ' ')
		.trim();

	return titleCasePhrase(cleaned || raw);
}
