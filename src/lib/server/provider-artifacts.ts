import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface ProviderArtifactFile {
	path: string;
	content: string;
}

export interface ProviderArtifactBundle {
	summary?: string;
	files: ProviderArtifactFile[];
	verification?: string[];
}

export function buildFilesystemArtifactPrompt(prompt: string): string {
	return [
		prompt,
		'',
		'API filesystem artifact contract:',
		'You are connected through an API and cannot edit the filesystem directly.',
		'Complete the requested implementation by returning ONLY valid JSON with this shape:',
		'{"summary":"short summary","files":[{"path":"index.html","content":"full file contents"}],"verification":["check performed"]}',
		'Rules:',
		'- File paths must be relative to the project root.',
		'- Do not use absolute paths, parent-directory traversal, or hidden system paths.',
		'- Include every file needed to open or run the project.',
		'- For no-build static web projects, include index.html and any referenced CSS or JavaScript files.',
		'- Do not wrap the JSON in markdown fences.'
	].join('\n');
}

function stripJsonFence(value: string): string {
	const trimmed = value.trim();
	const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fenced) return fenced[1].trim();
	const firstBrace = trimmed.indexOf('{');
	const lastBrace = trimmed.lastIndexOf('}');
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		return trimmed.slice(firstBrace, lastBrace + 1);
	}
	return trimmed;
}

function normalizeFiles(value: unknown): ProviderArtifactFile[] {
	if (Array.isArray(value)) {
		return value
			.map((entry) => {
				if (!entry || typeof entry !== 'object') return null;
				const record = entry as Record<string, unknown>;
				const filePath = record.path ?? record.name ?? record.file;
				const content = record.content ?? record.body ?? record.text;
				return typeof filePath === 'string' && typeof content === 'string'
					? { path: filePath, content }
					: null;
			})
			.filter((entry): entry is ProviderArtifactFile => Boolean(entry));
	}

	if (value && typeof value === 'object') {
		return Object.entries(value as Record<string, unknown>)
			.map(([filePath, content]) =>
				typeof content === 'string' ? { path: filePath, content } : null
			)
			.filter((entry): entry is ProviderArtifactFile => Boolean(entry));
	}

	return [];
}

export function parseProviderArtifactBundle(response: string): ProviderArtifactBundle {
	const parsed = JSON.parse(stripJsonFence(response)) as Record<string, unknown>;
	const files = normalizeFiles(parsed.files);
	return {
		summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
		files,
		verification: Array.isArray(parsed.verification)
			? parsed.verification.filter((entry): entry is string => typeof entry === 'string')
			: undefined
	};
}

function safeRelativeArtifactPath(filePath: string): string | null {
	const normalized = path.normalize(filePath.replace(/\\/g, '/'));
	if (!normalized || normalized === '.' || path.isAbsolute(normalized)) return null;
	if (normalized.split(/[\\/]+/).includes('..')) return null;
	return normalized.replace(/\\/g, '/');
}

export async function materializeProviderArtifacts(input: {
	response: string;
	workingDirectory: string;
}): Promise<{ ok: true; files: string[]; summary?: string } | { ok: false; error: string }> {
	let bundle: ProviderArtifactBundle;
	try {
		bundle = parseProviderArtifactBundle(input.response);
	} catch {
		return {
			ok: false,
			error:
				'Provider returned text, but hosted API execution requires JSON files so Spark can write the project workspace.'
		};
	}

	const files = bundle.files
		.map((file) => ({ ...file, path: safeRelativeArtifactPath(file.path) }))
		.filter((file): file is { path: string; content: string } => Boolean(file.path));

	if (files.length === 0) {
		return {
			ok: false,
			error: 'Provider returned no writable project files for the hosted workspace.'
		};
	}

	await mkdir(input.workingDirectory, { recursive: true });
	const written: string[] = [];
	for (const file of files) {
		const target = path.resolve(input.workingDirectory, file.path);
		const root = path.resolve(input.workingDirectory);
		if (target !== root && !target.startsWith(`${root}${path.sep}`)) continue;
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, file.content, 'utf-8');
		written.push(file.path);
	}

	if (written.length === 0) {
		return {
			ok: false,
			error: 'Provider artifact paths were rejected by workspace safety checks.'
		};
	}

	return { ok: true, files: written, summary: bundle.summary };
}
