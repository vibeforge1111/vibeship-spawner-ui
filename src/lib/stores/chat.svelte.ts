/**
 * Chat Store
 *
 * Manages chat messages and MCP tool interactions for the canvas
 */
import { writable, derived, get } from 'svelte/store';
import { mcpClient } from '$lib/services/mcp-client';
import { mcpState, connect } from './mcp.svelte';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	toolCall?: {
		name: string;
		args?: Record<string, unknown>;
		result?: unknown;
		error?: string;
	};
	isLoading?: boolean;
}

export interface ChatState {
	messages: ChatMessage[];
	isProcessing: boolean;
	error: string | null;
}

const initialState: ChatState = {
	messages: [],
	isProcessing: false,
	error: null
};

export const chatState = writable<ChatState>(initialState);

// Derived stores
export const messages = derived(chatState, ($state) => $state.messages);
export const isProcessing = derived(chatState, ($state) => $state.isProcessing);
export const chatError = derived(chatState, ($state) => $state.error);

// Helper to generate message IDs
function generateId(): string {
	return 'msg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Add a message to the chat
export function addMessage(role: ChatMessage['role'], content: string, toolCall?: ChatMessage['toolCall']): string {
	const id = generateId();
	const message: ChatMessage = {
		id,
		role,
		content,
		timestamp: new Date(),
		toolCall
	};

	chatState.update((state) => ({
		...state,
		messages: [...state.messages, message],
		error: null
	}));

	return id;
}

// Update a message
export function updateMessage(id: string, updates: Partial<ChatMessage>) {
	chatState.update((state) => ({
		...state,
		messages: state.messages.map((msg) =>
			msg.id === id ? { ...msg, ...updates } : msg
		)
	}));
}

// Clear chat history
export function clearChat() {
	chatState.set(initialState);
}

// Set processing state
function setProcessing(isProcessing: boolean) {
	chatState.update((state) => ({ ...state, isProcessing }));
}

// Set error
function setError(error: string | null) {
	chatState.update((state) => ({ ...state, error }));
}

/**
 * Parse user input to detect tool commands
 * Supports formats like:
 * - /skills search react
 * - /validate
 * - /analyze
 * - /watchout nextjs supabase
 */
function parseCommand(input: string): { tool: string; args: Record<string, unknown> } | null {
	const trimmed = input.trim();

	if (!trimmed.startsWith('/')) {
		return null;
	}

	const parts = trimmed.slice(1).split(/\s+/);
	const command = parts[0]?.toLowerCase();
	const rest = parts.slice(1);

	switch (command) {
		case 'skills':
		case 'skill':
			if (rest[0] === 'search' || rest[0] === 'find') {
				return { tool: 'spawner_skills', args: { action: 'search', query: rest.slice(1).join(' ') } };
			}
			if (rest[0] === 'get') {
				return { tool: 'spawner_skills', args: { action: 'get', name: rest.slice(1).join('-') } };
			}
			return { tool: 'spawner_skills', args: { action: 'list' } };

		case 'validate':
			return { tool: 'spawner_validate', args: { code: rest.join(' ') || '// No code provided', file_path: 'input.ts' } };

		case 'watchout':
		case 'watch':
		case 'gotchas':
			return { tool: 'spawner_watch_out', args: { stack: rest.length > 0 ? rest : ['nextjs', 'react', 'typescript'] } };

		case 'analyze':
			return { tool: 'spawner_analyze', args: { question: rest.join(' ') || 'What is this project?' } };

		case 'tools':
			return { tool: 'tools/list', args: {} };

		case 'ping':
			return { tool: 'ping', args: {} };

		case 'help':
			return { tool: 'help', args: {} };

		default:
			return null;
	}
}

/**
 * Format tool result for display
 */
function formatToolResult(toolName: string, result: unknown): string {
	if (toolName === 'help') {
		return `**Available Commands:**
- \`/skills\` - List all skills
- \`/skills search <query>\` - Search skills
- \`/skills get <name>\` - Get skill details
- \`/watchout [stack...]\` - Get gotchas for tech stack
- \`/analyze <question>\` - Analyze codebase
- \`/validate\` - Validate canvas workflow
- \`/tools\` - List MCP tools
- \`/ping\` - Check MCP connection
- \`/help\` - Show this help`;
	}

	if (toolName === 'spawner_skills') {
		const data = result as { skills?: Array<{ name: string; description?: string }>; skill?: { name: string; description?: string } };
		if (data.skills) {
			const skills = data.skills.slice(0, 10);
			return `**Found ${data.skills.length} skills:**\n${skills.map((s) => `- **${s.name}**: ${s.description || 'No description'}`).join('\n')}${data.skills.length > 10 ? `\n...and ${data.skills.length - 10} more` : ''}`;
		}
		if (data.skill) {
			return `**${data.skill.name}**\n${data.skill.description || 'No description'}`;
		}
	}

	if (toolName === 'spawner_watch_out') {
		const data = result as { gotchas?: Array<{ title: string; description: string }> };
		if (data.gotchas) {
			return `**Watch Out:**\n${data.gotchas.map((g) => `- **${g.title}**: ${g.description}`).join('\n')}`;
		}
	}

	if (toolName === 'tools/list') {
		const data = result as { tools?: Array<{ name: string; description: string }> };
		if (Array.isArray(data)) {
			return `**Available Tools:**\n${data.map((t: { name: string }) => `- ${t.name}`).join('\n')}`;
		}
	}

	// Fallback: stringify the result
	try {
		return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
	} catch {
		return String(result);
	}
}

/**
 * Send a message and process it
 */
export async function sendMessage(input: string): Promise<void> {
	const trimmed = input.trim();
	if (!trimmed) return;

	// Add user message
	addMessage('user', trimmed);
	setProcessing(true);

	try {
		// Check if it's a command
		const command = parseCommand(trimmed);

		if (command) {
			// Handle special 'help' command locally
			if (command.tool === 'help') {
				addMessage('assistant', formatToolResult('help', null));
				setProcessing(false);
				return;
			}

			// Check MCP connection
			const state = get(mcpState);
			if (state.status !== 'connected') {
				addMessage('system', 'Connecting to MCP server...');
				const connected = await connect();
				if (!connected) {
					addMessage('system', 'Failed to connect to MCP server. Make sure spawner-v2 is running.');
					setProcessing(false);
					return;
				}
				addMessage('system', 'Connected to MCP server.');
			}

			// Add loading message
			const loadingId = addMessage('assistant', `Calling \`${command.tool}\`...`, {
				name: command.tool,
				args: command.args,
				isLoading: true
			} as ChatMessage['toolCall']);

			// Call the tool
			const result = await mcpClient.callTool(command.tool, command.args);

			if (result.success) {
				updateMessage(loadingId, {
					content: formatToolResult(command.tool, result.data),
					toolCall: {
						name: command.tool,
						args: command.args,
						result: result.data
					},
					isLoading: false
				});
			} else {
				updateMessage(loadingId, {
					content: `Error: ${result.error}`,
					toolCall: {
						name: command.tool,
						args: command.args,
						error: result.error
					},
					isLoading: false
				});
			}
		} else {
			// Regular message - provide helpful response
			addMessage('assistant', `I received: "${trimmed}"\n\nTry using commands like:\n- \`/help\` - Show available commands\n- \`/skills search react\` - Search for skills\n- \`/watchout nextjs\` - Get gotchas for your stack`);
		}
	} catch (e) {
		setError(e instanceof Error ? e.message : 'An error occurred');
		addMessage('system', `Error: ${e instanceof Error ? e.message : 'Unknown error'}`);
	} finally {
		setProcessing(false);
	}
}
