import { describe, expect, it } from 'vitest';

import { load } from './[id]/+page.server';

describe('/missions/[id] redirect', () => {
	it('sends legacy mission detail links to the focused Kanban board', async () => {
		try {
			await load({ params: { id: 'mission 1/2' } } as never);
			throw new Error('Expected redirect');
		} catch (error) {
			expect(error).toMatchObject({
				status: 307,
				location: '/kanban?mission=mission%201%2F2'
			});
		}
	});
});
