/// <reference types="vitest" />

import { defineConfig } from 'vite';
import sveltePreprocess from 'svelte-preprocess';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte({ preprocess: sveltePreprocess() })],
  test: {
    include: ['**/*.{test,spec}.{ts,mts,cts,tsx}'],
    sequence: { shuffle: true },
  },
});
