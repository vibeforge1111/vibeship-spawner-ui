import { redirect } from '@sveltejs/kit';

export function GET(): never {
	throw redirect(308, '/kanban');
}
