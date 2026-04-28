/**
 * brief-enricher.ts — pre-generation pass that lifts vague briefs into
 * something the canvas generator can actually plan against.
 *
 * The eval suite found that vague inputs ("build me an app") plateau at
 * grade B no matter how many improver iterations run, because feedback
 * injection cannot invent missing requirements. The fix is upstream:
 * before the canvas generator runs, infer sensible defaults and flag
 * what's still ambiguous so the user can clarify.
 *
 * Output shape (the enricher always returns an enrichedContent that's
 * safe to pass downstream — it never blocks on missing info):
 *
 *   {
 *     enrichedContent: string,         // PRD with inferred defaults baked in
 *     addedAssumptions: string[],      // defaults the enricher chose
 *     openQuestions: string[],         // things the user could clarify
 *     wasEnriched: boolean             // true when defaults were added
 *   }
 *
 * Skipped (passes brief through untouched) when content is already long
 * + specific (>= 600 chars, includes ## section headers, or > 8 distinct
 * concrete keywords). Threshold tunable via env.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { resolveCliBinary } from './cli-resolver';

// Aggressive timeout: enrichment is a nice-to-have. If claude can't
// respond fast, use deterministic assumptions/questions so the user's
// request doesn't stall the bot. Override via BRIEF_ENRICH_TIMEOUT_MS.
const ENRICH_TIMEOUT_MS = Number(process.env.BRIEF_ENRICH_TIMEOUT_MS || 12_000);
const ENRICH_MIN_LENGTH = Number(process.env.BRIEF_ENRICH_MIN_LENGTH || 600);
const ENRICH_MIN_KEYWORDS = Number(process.env.BRIEF_ENRICH_MIN_KEYWORDS || 8);
const ENRICH_PROVIDER = (process.env.SPAWNER_BRIEF_ENRICH_PROVIDER || 'deterministic').trim().toLowerCase();

export interface EnrichmentResult {
	enrichedContent: string;
	addedAssumptions: string[];
	openQuestions: string[];
	wasEnriched: boolean;
}

const KEYWORD_HINTS = [
	'auth', 'oauth', 'login', 'database', 'postgres', 'stripe', 'payment',
	'subscription', 'email', 'admin', 'dashboard', 'rate limit', 'queue',
	'realtime', 'websocket', 'api', 'mobile', 'web', 'static', 'rest',
	'graphql', 'analytics', 'ssr', 'spa', 'cdn', 'cache', 'redis', 's3',
	'arweave', 'solana', 'evm', 'nft', 'audit', 'compliance', 'rbac',
	'multi-tenant', 'tenant', 'workspace', 'org', 'role', 'mfa', 'sso',
	'webhook', 'event', 'pipeline', 'agent', 'llm', 'rag', 'retrieval',
	'classifier', 'scorer', 'feedback'
];

function estimateSpecificity(content: string): { length: number; keywords: number; hasSections: boolean } {
	const length = content.length;
	const lower = content.toLowerCase();
	let keywords = 0;
	for (const kw of KEYWORD_HINTS) if (lower.includes(kw)) keywords++;
	const hasSections = /^##\s+\w+/m.test(content);
	return { length, keywords, hasSections };
}

function shouldSkipEnrichment(content: string): boolean {
	const sig = estimateSpecificity(content);
	if (sig.length >= ENRICH_MIN_LENGTH) return true;
	if (sig.hasSections && sig.keywords >= 4) return true;
	if (sig.keywords >= ENRICH_MIN_KEYWORDS) return true;
	return false;
}

const ENRICH_PROMPT_TEMPLATE = `You are the spawner-ui brief enricher. The user submitted a project brief that may be too vague for a downstream canvas generator. Your job is to (1) infer reasonable defaults from the founder-mode software-product domain, (2) bake those defaults into a usable PRD, (3) list any remaining ambiguity as open questions.

Output strict JSON in a fenced \`\`\`json block. No prose outside the block.

Schema:
{
  "enrichedContent": "<a more complete PRD-style brief, ready for a canvas generator. Preserve user's actual phrasing where present, add inferred defaults clearly marked '(assumed)'>",
  "addedAssumptions": ["<one-line assumption you made>", ...],
  "openQuestions": ["<one-line question the user could answer to tighten the brief>", ...]
}

Guidance:
- Always output a usable enrichedContent. Never block.
- Choose defaults a sensible solo founder would pick: web app, modern stack, single-tenant v1, OAuth via managed provider, Postgres, basic analytics, deploy on Vercel/Cloudflare.
- Keep the enrichedContent under 1500 characters.
- 3-6 addedAssumptions max.
- 3-6 openQuestions max — the SHARPEST clarifications that would change the canvas materially.
- Do not invent product features the user didn't gesture at. Stay close to their wording; expand only the structural defaults around it.

USER BRIEF:
{{BRIEF}}`;

function extractJson(text: string): string | null {
	const fence = /\`\`\`json\s*([\s\S]*?)\`\`\`/i;
	const m = text.match(fence);
	if (m && m[1].trim()) return m[1].trim();
	const looseFence = /\`\`\`\s*([\s\S]*?)\`\`\`/;
	const m2 = text.match(looseFence);
	if (m2 && m2[1].trim().startsWith('{')) return m2[1].trim();
	const firstBrace = text.indexOf('{');
	const lastBrace = text.lastIndexOf('}');
	if (firstBrace >= 0 && lastBrace > firstBrace) {
		const candidate = text.slice(firstBrace, lastBrace + 1).trim();
		try {
			JSON.parse(candidate);
			return candidate;
		} catch {
			return null;
		}
	}
	return null;
}

export function buildDeterministicEnrichment(content: string): EnrichmentResult {
	const brief = content.trim();
	const productName = brief.length <= 80 ? brief : `${brief.slice(0, 77)}...`;
	const addedAssumptions = [
		'Assume this is a web app unless the user specifies mobile, desktop, or another surface.',
		'Assume a practical solo-founder v1 with authentication, persisted data, and a clean core workflow.',
		'Assume the build should include basic error states, responsive UI, and a simple verification path.'
	];
	const openQuestions = [
		'Who is the first user this app is for?',
		'What is the one action the app must make easy?',
		'Does it need accounts/login in v1?',
		'What data should be saved or shown first?'
	];
	const enrichedContent = [
		'# Inferred Project Brief',
		`Original user request: ${brief}`,
		'',
		'## Product Direction',
		`Build a small but usable web app for: ${productName}.`,
		'Focus on one clear user workflow, a polished first screen, and enough structure that the project can be extended after v1.',
		'',
		'## Assumed V1 Scope',
		'- Responsive web UI with a clear primary action.',
		'- Basic state/data persistence where the product needs memory between sessions.',
		'- Friendly empty, loading, and error states.',
		'- Minimal verification steps so the builder can prove the app works.',
		'',
		'## Open Questions',
		...openQuestions.map((question) => `- ${question}`)
	].join('\n');

	return {
		enrichedContent,
		addedAssumptions,
		openQuestions,
		wasEnriched: true
	};
}

export interface ClaudePrintSpawnCommand {
	command: string;
	args: string[];
	shell: boolean;
	windowsVerbatimArguments?: boolean;
}

function quoteForCmd(value: string): string {
	return `"${value.replace(/"/g, '""')}"`;
}

function resolveWindowsClaudeExecutable(resolvedBinary: string): string | null {
	if (!resolvedBinary.toLowerCase().endsWith('.cmd')) return null;
	const candidate = join(dirname(resolvedBinary), 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
	return existsSync(candidate) ? candidate : null;
}

export function buildClaudePrintSpawnCommand(
	resolvedBinary = resolveCliBinary('claude') || 'claude',
	platform = process.platform
): ClaudePrintSpawnCommand {
	if (platform === 'win32') {
		if (!resolvedBinary.toLowerCase().endsWith('.cmd')) {
			return {
				command: resolvedBinary,
				args: ['--print'],
				shell: false
			};
		}
		const directExecutable = resolveWindowsClaudeExecutable(resolvedBinary);
		if (directExecutable) {
			return {
				command: directExecutable,
				args: ['--print'],
				shell: false
			};
		}
		return {
			command: process.env.ComSpec || 'cmd.exe',
			args: ['/d', '/c', `${quoteForCmd(resolvedBinary)} --print`],
			shell: false,
			windowsVerbatimArguments: true
		};
	}
	return {
		command: resolvedBinary,
		args: ['--print'],
		shell: false
	};
}

function runClaudePrint(prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const command = buildClaudePrintSpawnCommand();
		const child = spawn(command.command, command.args, {
			stdio: ['pipe', 'pipe', 'pipe'],
			windowsHide: true,
			shell: command.shell,
			windowsVerbatimArguments: command.windowsVerbatimArguments,
			env: { ...process.env }
		});
		let stdout = '';
		let stderr = '';
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			reject(new Error(`brief-enricher claude --print timed out after ${ENRICH_TIMEOUT_MS}ms`));
		}, ENRICH_TIMEOUT_MS);
		child.stdout.on('data', (chunk) => {
			stdout += chunk.toString('utf-8');
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk.toString('utf-8');
		});
		child.on('error', (err) => {
			clearTimeout(timer);
			reject(new Error(`brief-enricher spawn failed: ${err.message}`));
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code !== 0) {
				reject(new Error(`brief-enricher exited ${code}. stderr: ${stderr.slice(0, 300)}`));
				return;
			}
			resolve(stdout);
		});
		child.stdin.write(prompt);
		child.stdin.end();
	});
}

export async function enrichBrief(content: string): Promise<EnrichmentResult> {
	if (shouldSkipEnrichment(content)) {
		return {
			enrichedContent: content,
			addedAssumptions: [],
			openQuestions: [],
			wasEnriched: false
		};
	}

	if (ENRICH_PROVIDER !== 'claude') {
		return buildDeterministicEnrichment(content);
	}

	try {
		const prompt = ENRICH_PROMPT_TEMPLATE.replace('{{BRIEF}}', content);
		const stdout = await runClaudePrint(prompt);
		const json = extractJson(stdout);
		if (!json) {
			console.warn('[brief-enricher] no JSON in claude output, falling back to deterministic brief');
			return buildDeterministicEnrichment(content);
		}
		const parsed = JSON.parse(json) as Partial<EnrichmentResult>;
		const enrichedContent = typeof parsed.enrichedContent === 'string' && parsed.enrichedContent.trim()
			? parsed.enrichedContent
			: content;
		return {
			enrichedContent,
			addedAssumptions: Array.isArray(parsed.addedAssumptions)
				? parsed.addedAssumptions.filter((a): a is string => typeof a === 'string')
				: [],
			openQuestions: Array.isArray(parsed.openQuestions)
				? parsed.openQuestions.filter((q): q is string => typeof q === 'string')
				: [],
			wasEnriched: enrichedContent !== content
		};
	} catch (err) {
		console.warn('[brief-enricher] enrichment failed, falling back to deterministic brief:', err);
		return buildDeterministicEnrichment(content);
	}
}
