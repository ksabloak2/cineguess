import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/frames': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Target modern browsers — smaller output, no legacy transforms.
    target: 'es2020',

    // Skip source maps in production to reduce bundle size and prevent
    // accidental source exposure.
    sourcemap: false,

    rollupOptions: {
      output: {
        // Split vendor code into separate cacheable chunks.
        // When app code changes, users only re-download the app chunk —
        // the heavy vendor/supabase/axios chunks stay cached.
        manualChunks: {
          vendor:   ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          axios:    ['axios'],
        },
      },
    },
  },

  // Strip all console.* and debugger statements from production bundles.
  // Keeps logs out of users' DevTools and shaves a few KB off the bundle.
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
