/**
 * OpenAI-Compatible Provider Client
 *
 * Reusable client for any OpenAI-compatible chat completions API:
 * Minimax, OpenAI, Kimi, OpenRouter, Ollama, etc.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import type { ProviderResult, ProviderClientOptions, ChatMessage } from './types';
import { createBridgeEvent } from './types';

export interface OpenAICompatOptions extends ProviderClientOptions {
	apiKey: string;
	workspace?: string;
}

interface StreamChunkChoice {
	delta?: { content?: string; role?: string };
	finish_reason?: string | null;
	index?: number;
}

interface StreamChunk {
	id?: string;
	choices?: StreamChunkChoice[];
	usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

interface MaterializedFile {
	path: string;
	content: string;
}

export async function executeOpenAICompatRequest(
	options: OpenAICompatOptions,
	messages: ChatMessage[],
	streaming = true
): Promise<ProviderResult> {
	const { provider, apiKey, missionId, signal, onEvent } = options;
	const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
	const startTime = Date.now();

	onEvent(
		createBridgeEvent('task_started', options, {
			message: `${provider.label} starting (model: ${provider.model})`,
			data: { provider: provider.id, model: provider.model }
		})
	);

	let lastError: string | undefined;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		if (signal?.aborted) {
			return { success: false, error: 'Cancelled', durationMs: Date.now() - startTime };
		}

		try {
			const response = await fetch(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
				},
				body: JSON.stringify({
					model: provider.model,
					messages,
					stream: streaming,
					max_tokens: 16384
				}),
				signal
			});

			if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
				const retryAfter = response.headers.get('retry-after');
				const delay = retryAfter
					? parseInt(retryAfter, 10) * 1000
					: RETRY_BASE_MS * Math.pow(2, attempt);
				lastError = `HTTP ${response.status} from ${provider.label}`;
				onEvent(
					createBridgeEvent('task_progress', options, {
						message: `${provider.label}: retrying after ${response.status} (attempt ${attempt + 1}/${MAX_RETRIES})`,
						progress: 0
					})
				);
				await sleep(delay, signal);
				continue;
			}

			if (!response.ok) {
				const errorText = await response.text().catch(() => 'unknown error');
				return {
					success: false,
					error: `${provider.label} API error ${response.status}: ${errorText.slice(0, 500)}`,
					durationMs: Date.now() - startTime
				};
			}

			if (streaming && response.body) {
				return await handleStreamingResponse(options, response, startTime);
			} else {
				return await handleNonStreamingResponse(options, response, startTime);
			}
		} catch (err) {
			if (signal?.aborted) {
				return { success: false, error: 'Cancelled', durationMs: Date.now() - startTime };
			}
			lastError = err instanceof Error ? err.message : String(err);
			if (attempt < MAX_RETRIES - 1) {
				await sleep(RETRY_BASE_MS * Math.pow(2, attempt), signal);
			}
		}
	}

	const failureMessage = lastError || `${provider.label} failed after ${MAX_RETRIES} retries`;
	onEvent(
		createBridgeEvent('task_failed', options, {
			message: `${provider.label} failed after ${MAX_RETRIES} attempts: ${lastError}`,
			data: {
				success: false,
				error: failureMessage,
				provider: provider.id,
				providerLabel: provider.label
			}
		})
	);

	return {
		success: false,
		error: failureMessage,
		durationMs: Date.now() - startTime
	};
}

async function handleStreamingResponse(
	options: OpenAICompatOptions,
	response: Response,
	startTime: number
): Promise<ProviderResult> {
	const { provider, onEvent } = options;
	const reader = response.body!.getReader();
	const decoder = new TextDecoder();
	let fullContent = '';
	let buffer = '';
	let lastProgressEmit = Date.now();
	let tokenUsage: ProviderResult['tokenUsage'];

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.startsWith('data: ')) continue;
				const payload = trimmed.slice(6);
				if (payload === '[DONE]') continue;

				try {
					const chunk: StreamChunk = JSON.parse(payload);
					const content = chunk.choices?.[0]?.delta?.content;
					if (content) {
						fullContent += content;
					}
					if (chunk.usage) {
						tokenUsage = {
							prompt: chunk.usage.prompt_tokens || 0,
							completion: chunk.usage.completion_tokens || 0,
							total: chunk.usage.total_tokens || 0
						};
					}
				} catch {
					// Skip malformed chunks
				}
			}

			// Emit progress every 2 seconds to avoid flooding
			const now = Date.now();
			if (now - lastProgressEmit > 2000) {
				const progress = Math.min(90, Math.floor((fullContent.length / 8000) * 100));
				onEvent(
					createBridgeEvent('task_progress', options, {
						progress,
						message: `${provider.label}: streaming response (${fullContent.length} chars)...`
					})
				);
				lastProgressEmit = now;
			}
		}
	} catch (err) {
		if (options.signal?.aborted) {
			return { success: false, error: 'Cancelled', durationMs: Date.now() - startTime };
		}
		throw err;
	}

	const finalized = await finalizeOpenAICompatContent(options, fullContent);

	onEvent(
		createBridgeEvent('task_completed', options, {
			message: `${provider.label} completed (${finalized.response.length} chars)`,
			data: {
				success: true,
				responseLength: finalized.response.length,
				response: finalized.response,
				provider: provider.id,
				providerLabel: provider.label
			}
		})
	);

	return {
		success: true,
		response: finalized.response,
		tokenUsage,
		durationMs: Date.now() - startTime
	};
}

async function handleNonStreamingResponse(
	options: OpenAICompatOptions,
	response: Response,
	startTime: number
): Promise<ProviderResult> {
	const { provider, onEvent } = options;
	const data = await response.json();

	const content = data.choices?.[0]?.message?.content || '';
	const usage = data.usage;
	const tokenUsage = usage
		? {
				prompt: usage.prompt_tokens || 0,
				completion: usage.completion_tokens || 0,
				total: usage.total_tokens || 0
			}
		: undefined;

	const finalized = await finalizeOpenAICompatContent(options, content);

	onEvent(
		createBridgeEvent('task_completed', options, {
			message: `${provider.label} completed (${finalized.response.length} chars)`,
			data: {
				success: true,
				responseLength: finalized.response.length,
				response: finalized.response,
				provider: provider.id,
				providerLabel: provider.label
			}
		})
	);

	return {
		success: true,
		response: finalized.response,
		tokenUsage,
		durationMs: Date.now() - startTime
	};
}

export function extractMaterializableFiles(text: string): MaterializedFile[] {
	const fromJson = extractFilesFromJson(text);
	if (fromJson.length > 0) return dedupeFiles(fromJson).filter((file) => safeRelativePath(file.path));

	const files: MaterializedFile[] = [];
	const fencePattern = /```([A-Za-z0-9_.-]*)\s*\n([\s\S]*?)```/g;
	let match: RegExpExecArray | null;
	while ((match = fencePattern.exec(text))) {
		const language = (match[1] || '').trim().toLowerCase();
		const content = match[2] || '';
		const filename = filenameForFence(language, files.length);
		if (filename && content.trim()) files.push({ path: filename, content: content.trimStart() });
	}

	if (files.length === 0 && /<!doctype html|<html[\s>]/i.test(text)) {
		files.push({ path: 'index.html', content: text.trim() });
	}

	return dedupeFiles(files).filter((file) => safeRelativePath(file.path));
}

async function finalizeOpenAICompatContent(
	options: OpenAICompatOptions,
	content: string
): Promise<{ response: string }> {
	const workspace = options.workspace?.trim();
	if (!workspace) return { response: content };

	const files = extractMaterializableFiles(content);
	if (files.length === 0) return { response: content };

	for (const file of files) {
		const target = join(workspace, file.path);
		await mkdir(dirname(target), { recursive: true });
		await writeFile(target, file.content, 'utf8');
	}

	return {
		response: JSON.stringify({
			status: 'completed',
			summary: `Materialized ${files.length} hosted project file${files.length === 1 ? '' : 's'} from ${options.provider.label}.`,
			project_path: workspace,
			changed_files: files.map((file) => file.path),
			verification: ['Created files in the hosted Spark workspace for preview.']
		})
	};
}

function extractFilesFromJson(text: string): MaterializedFile[] {
	const parsed = parsePossibleJson(text);
	if (!parsed || typeof parsed !== 'object') return [];
	const record = parsed as Record<string, unknown>;
	const files = record.files;
	if (Array.isArray(files)) {
		return files
			.map((entry) => {
				if (!entry || typeof entry !== 'object') return null;
				const file = entry as Record<string, unknown>;
				const path = typeof file.path === 'string' ? file.path : typeof file.name === 'string' ? file.name : '';
				const content = typeof file.content === 'string' ? file.content : '';
				return path && content ? { path, content } : null;
			})
			.filter((file): file is MaterializedFile => Boolean(file));
	}
	if (files && typeof files === 'object') {
		return Object.entries(files as Record<string, unknown>)
			.map(([path, content]) => (typeof content === 'string' ? { path, content } : null))
			.filter((file): file is MaterializedFile => Boolean(file));
	}
	return [];
}

function parsePossibleJson(text: string): unknown | null {
	const trimmed = text.trim();
	const jsonText = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)?.[1]?.trim() || trimmed;
	try {
		return JSON.parse(jsonText);
	} catch {
		return null;
	}
}

function filenameForFence(language: string, index: number): string | null {
	const normalized = language.replace(/^\./, '');
	if (normalized === 'html' || normalized === 'htm') return 'index.html';
	if (normalized === 'css') return 'styles.css';
	if (normalized === 'js' || normalized === 'javascript') return 'app.js';
	if (normalized === 'json') return index === 0 ? null : `data-${index + 1}.json`;
	return index === 0 ? 'index.html' : null;
}

function safeRelativePath(path: string): boolean {
	const normalized = normalize(path).replace(/\\/g, '/');
	return Boolean(normalized) && !normalized.startsWith('../') && !normalized.startsWith('/') && !/^[A-Za-z]:\//.test(normalized);
}

function dedupeFiles(files: MaterializedFile[]): MaterializedFile[] {
	const byPath = new Map<string, MaterializedFile>();
	for (const file of files) {
		if (!safeRelativePath(file.path)) continue;
		byPath.set(normalize(file.path).replace(/\\/g, '/'), file);
	}
	return [...byPath.values()];
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error('Cancelled'));
			return;
		}
		const timer = setTimeout(resolve, ms);
		signal?.addEventListener(
			'abort',
			() => {
				clearTimeout(timer);
				reject(new Error('Cancelled'));
			},
			{ once: true }
		);
	});
}
