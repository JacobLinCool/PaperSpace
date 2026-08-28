import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'worker-src': ['self', 'blob:'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'blob:', 'data:'],
				'font-src': ['self'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		},
		adapter: adapter({
			pages: 'dist',
			assets: 'dist',
			fallback: '404.html',
			precompress: true,
			strict: true
		})
	}
};

export default config;
