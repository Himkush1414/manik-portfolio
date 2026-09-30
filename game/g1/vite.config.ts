// Standalone production build for /game/g1/ (its own Rollup graph, so the
// game never shares chunks with the portfolio — e.g. three.js tree-shaken for
// the game alone). Invoked by the portfolio's build via a tiny plugin in the
// root vite.config.js; in dev the portfolio's Vite serves this folder as-is.
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: __dirname,
  base: '/game/g1/',
  publicDir: resolve(__dirname, 'public'),
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: resolve(__dirname, '../../dist/game/g1'),
    emptyOutDir: true,
    // three + R3F + postprocessing are inherently large for a WebGL app; they
    // are split into cacheable vendor chunks below, scenes are lazy-loaded.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          post: ['postprocessing', 'n8ao'],
        },
      },
    },
  },
});
