import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.{js,mjs}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/tests/setup.ts']
	}
});
