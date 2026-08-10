import { defineConfig } from 'vite';

export default defineConfig({
  // Windows' app sandbox can block esbuild's dependency pre-bundler from
  // opening packages under Desktop. Three.js is already native ESM, so it can
  // be served directly without that optimization step.
  optimizeDeps: {
    noDiscovery: true,
    include: [],
  },
  server: {
    host: '0.0.0.0',
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
