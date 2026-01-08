/**
 * Simple Test MCP Server
 *
 * A minimal MCP server for testing connections.
 * Provides basic tools: echo, time, random number
 *
 * Run with: npx tsx src/lib/services/mcp/test-server.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
	{
		name: 'test-mcp-server',
		version: '1.0.0',
	},
	{
		capabilities: {
			tools: {},
		},
	}
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: 'echo',
				description: 'Echoes back the input message',
				inputSchema: {
					type: 'object',
					properties: {
						message: {
							type: 'string',
							description: 'Message to echo back',
						},
					},
					required: ['message'],
				},
			},
			{
				name: 'get_time',
				description: 'Returns the current date and time',
				inputSchema: {
					type: 'object',
					properties: {},
				},
			},
			{
				name: 'random_number',
				description: 'Generates a random number between min and max',
				inputSchema: {
					type: 'object',
					properties: {
						min: {
							type: 'number',
							description: 'Minimum value (default: 0)',
						},
						max: {
							type: 'number',
							description: 'Maximum value (default: 100)',
						},
					},
				},
			},
			{
				name: 'add',
				description: 'Adds two numbers together',
				inputSchema: {
					type: 'object',
					properties: {
						a: { type: 'number', description: 'First number' },
						b: { type: 'number', description: 'Second number' },
					},
					required: ['a', 'b'],
				},
			},
		],
	};
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	switch (name) {
		case 'echo':
			return {
				content: [
					{
						type: 'text',
						text: `Echo: ${(args as { message: string }).message}`,
					},
				],
			};

		case 'get_time':
			return {
				content: [
					{
						type: 'text',
						text: new Date().toISOString(),
					},
				],
			};

		case 'random_number': {
			const min = (args as { min?: number }).min ?? 0;
			const max = (args as { max?: number }).max ?? 100;
			const random = Math.floor(Math.random() * (max - min + 1)) + min;
			return {
				content: [
					{
						type: 'text',
						text: `Random number between ${min} and ${max}: ${random}`,
					},
				],
			};
		}

		case 'add': {
			const { a, b } = args as { a: number; b: number };
			return {
				content: [
					{
						type: 'text',
						text: `${a} + ${b} = ${a + b}`,
					},
				],
			};
		}

		default:
			throw new Error(`Unknown tool: ${name}`);
	}
});

// Start server
async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error('Test MCP Server running on stdio');
}

main().catch(console.error);
