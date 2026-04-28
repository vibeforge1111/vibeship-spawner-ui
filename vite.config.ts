import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const allowedHosts = (process.env.SPARK_ALLOWED_HOSTS ?? '')
	.split(',')
	.map((host) => host.trim())
	.filter(Boolean);

export default defineConfig({
	plugins: [sveltekit()],
	server: allowedHosts.length > 0 ? { allowedHosts } : undefined
});
