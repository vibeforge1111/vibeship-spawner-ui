/**
 * API endpoint for submitting AI rewrite requests
 *
 * Claude Code will monitor this endpoint and process requests
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SPAWNER_DIR = '.spawner';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const data = await request.json();
		const { requestId, draft, context, platform, timestamp } = data;

		if (!requestId || !draft) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Ensure .spawner directory exists
		if (!existsSync(SPAWNER_DIR)) {
			await mkdir(SPAWNER_DIR, { recursive: true });
		}

		// Write the rewrite request for Claude Code to process
		const requestContent = `# AI Rewrite Request

**Request ID:** ${requestId}
**Platform:** ${platform || 'twitter'}
**Timestamp:** ${timestamp}

## Draft Content

${draft}

## Analysis Context

${context}

## Instructions for Claude

Generate 3 improved versions of the draft:

1. **Hook-Optimized**: Focus on a stronger, more attention-grabbing opening
2. **Emotion-Amplified**: Add more emotional resonance and personal connection
3. **Topic-Enhanced**: Better keyword coverage and trending topic integration

For each version provide:
- The full rewritten content
- Estimated score (0-100)
- List of changes made

Respond by POSTing to /api/contentforge/rewrite/result with:
\`\`\`json
{
  "requestId": "${requestId}",
  "status": "complete",
  "rewrites": [
    {
      "version": "Hook-Optimized",
      "content": "...",
      "estimatedScore": 78,
      "changes": ["Added curiosity hook", "Specific numbers"]
    }
  ]
}
\`\`\`
`;

		await writeFile(
			path.join(SPAWNER_DIR, 'pending-rewrite.md'),
			requestContent,
			'utf-8'
		);

		// Also write JSON metadata
		await writeFile(
			path.join(SPAWNER_DIR, 'pending-rewrite.json'),
			JSON.stringify({
				requestId,
				draft,
				context,
				platform,
				timestamp,
				status: 'pending'
			}, null, 2),
			'utf-8'
		);

		console.log('[RewriteAPI] Request submitted:', requestId);

		return json({
			success: true,
			requestId,
			message: 'Rewrite request submitted. Claude Code will process it.'
		});

	} catch (e) {
		console.error('[RewriteAPI] Error:', e);
		return json({
			error: e instanceof Error ? e.message : 'Unknown error'
		}, { status: 500 });
	}
};
