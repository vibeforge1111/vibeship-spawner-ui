import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, delimiter, join, resolve, sep } from 'node:path';

export class ProjectPreviewError extends Error {
	status: 400 | 403 | 404;

	constructor(message: string, status: 400 | 403 | 404) {
		super(message);
		this.name = 'ProjectPreviewError';
		this.status = status;
	}
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,4096}$/;

function uniqueResolved(paths: string[]): string[] {
	return [...new Set(paths.map((candidate) => resolve(candidate)))];
}

function splitConfiguredRoots(value: string | undefined): string[] {
	if (!value?.trim()) return [];
	return value
		.split(delimiter)
		.flatMap((part) => part.split('\n'))
		.map((part) => part.trim())
		.filter(Boolean);
}

function pathIsInside(candidate: string, parent: string): boolean {
	const resolvedCandidate = resolve(candidate).toLowerCase();
	const resolvedParent = resolve(parent).toLowerCase();
	return resolvedCandidate === resolvedParent || resolvedCandidate.startsWith(`${resolvedParent}${sep}`);
}

export function encodeProjectPreviewToken(projectPath: string): string {
	return Buffer.from(resolve(projectPath), 'utf8').toString('base64url');
}

export function decodeProjectPreviewToken(token: string): string {
	if (!TOKEN_PATTERN.test(token)) {
		throw new ProjectPreviewError('Invalid project preview token', 400);
	}
	const decoded = Buffer.from(token, 'base64url').toString('utf8').trim();
	if (!decoded) {
		throw new ProjectPreviewError('Invalid project preview token', 400);
	}
	return resolve(decoded);
}

export function projectPreviewUrl(baseUrl: string, projectPath: string): string {
	const trimmedBase = baseUrl.replace(/\/+$/, '');
	return `${trimmedBase}/preview/${encodeProjectPreviewToken(projectPath)}/index.html`;
}

export function getProjectPreviewAllowedRoots(env: NodeJS.ProcessEnv = process.env): string[] {
	const configured = splitConfiguredRoots(env.SPARK_PROJECT_PREVIEW_ROOTS || env.SPAWNER_PROJECT_PREVIEW_ROOTS);
	if (configured.length > 0) return uniqueResolved(configured);

	const home = homedir();
	return uniqueResolved([
		join(home, 'Desktop'),
		join(home, 'Documents'),
		join(home, '.spark', 'workspaces'),
		env.SPARK_WORKSPACE_ROOT || '',
		env.SPAWNER_WORKSPACE_ROOT || '',
		env.SPARK_HOME ? join(env.SPARK_HOME, 'workspaces') : ''
	].filter(Boolean));
}

export function assertProjectPreviewHost(url: URL, env: NodeJS.ProcessEnv = process.env): void {
	if (env.SPAWNER_PROJECT_PREVIEW_ALLOW_REMOTE === '1') return;
	const hostname = url.hostname.toLowerCase();
	if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return;
	const railwayPublicDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim().toLowerCase();
	if (railwayPublicDomain && hostname === railwayPublicDomain) return;
	throw new ProjectPreviewError('Project previews are local-only by default', 403);
}

export function mimeTypeForProjectPreview(filePath: string): string {
	const extension = filePath.split('.').pop()?.toLowerCase();
	switch (extension) {
		case 'html':
		case 'htm':
			return 'text/html; charset=utf-8';
		case 'css':
			return 'text/css; charset=utf-8';
		case 'js':
		case 'mjs':
			return 'text/javascript; charset=utf-8';
		case 'json':
			return 'application/json; charset=utf-8';
		case 'svg':
			return 'image/svg+xml';
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		case 'ico':
			return 'image/x-icon';
		case 'woff':
			return 'font/woff';
		case 'woff2':
			return 'font/woff2';
		default:
			return 'application/octet-stream';
	}
}

export function resolveProjectPreviewAsset(input: {
	token: string;
	assetPath?: string | null;
	env?: NodeJS.ProcessEnv;
}): { projectRoot: string; filePath: string; displayName: string } {
	const projectRoot = decodeProjectPreviewToken(input.token);
	const allowedRoots = getProjectPreviewAllowedRoots(input.env);
	if (!allowedRoots.some((root) => pathIsInside(projectRoot, root))) {
		throw new ProjectPreviewError('Project preview path is outside allowed roots', 403);
	}

	if (!existsSync(projectRoot) || !statSync(projectRoot).isDirectory()) {
		throw new ProjectPreviewError('Project preview folder was not found', 404);
	}

	const safeAssetPath = (input.assetPath || 'index.html').replace(/^[/\\]+/, '') || 'index.html';
	let filePath = resolve(projectRoot, safeAssetPath);
	if (!pathIsInside(filePath, projectRoot)) {
		throw new ProjectPreviewError('Project preview asset escapes the project folder', 403);
	}

	if (existsSync(filePath) && statSync(filePath).isDirectory()) {
		filePath = join(filePath, 'index.html');
	}

	if (!existsSync(filePath) || !statSync(filePath).isFile()) {
		throw new ProjectPreviewError('Project preview asset was not found', 404);
	}

	return {
		projectRoot,
		filePath,
		displayName: basename(filePath)
	};
}
