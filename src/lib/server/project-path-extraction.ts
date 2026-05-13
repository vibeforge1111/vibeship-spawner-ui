const PATH_SOURCE = String.raw`(?<![A-Za-z])(?:[A-Z]:[\\/]|\/(?:Users|home|tmp|var|mnt|data|workspaces?|workspace|srv|opt|repo|app|projects?)(?:\/|$))[^\r\n\`"<>|?*]*`;
const ABSOLUTE_PATH_PATTERN = new RegExp(PATH_SOURCE, 'i');

function trimCandidateAtSentenceBoundary(candidate: string): string {
	const boundaries = [
		/\.\s+(?:You|Create|Include|Do|Put|Use|Files?|Mode|Mission)\b/i,
		/\s+(?:You must|Create only|Include the|Do not|Put all|Use only)\b/i,
		/:\s+(?:a|an|the)\s+/i
	];
	let end = candidate.length;
	for (const pattern of boundaries) {
		const match = pattern.exec(candidate);
		if (match && match.index < end) end = match.index;
	}
	return candidate.slice(0, end);
}

export function cleanProjectPathCandidate(value: string | null | undefined): string | null {
	if (!value) return null;
	const cleaned = trimCandidateAtSentenceBoundary(value)
		.trim()
		.replace(/^`|`$/g, '')
		.replace(/\s+(?:as|inside|with|and)\b.*$/i, '')
		.replace(/[).,;:\s]+$/, '');
	return cleaned || null;
}

export function extractExplicitProjectPath(text: string): string | null {
	const match =
		text.match(new RegExp(`Improve the existing shipped project\\s+"[^"]+"\\s+at\\s+(\\\`?(${PATH_SOURCE}))`, 'i')) ||
		text.match(
			new RegExp(`\\b(?:target operating-system folder|project path|target folder|create it at|create it in|create this at|create this in|build it at|build it in|build this at|build this in|inside|at|in)\\b\\s*:?\\s*\\\`?(${PATH_SOURCE})`, 'i')
		) ||
		text.match(ABSOLUTE_PATH_PATTERN);
	const candidate = match ? match[2] || match[1] || match[0] : null;
	return cleanProjectPathCandidate(candidate);
}
