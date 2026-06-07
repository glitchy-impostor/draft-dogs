import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Build-time env:
//   VITE_BASE_PATH  — subpath for GH Pages (e.g. "/draft-dogs-redesign/").
//                     Defaults to "/" so local dev and Railway-style root
//                     hosting both Just Work without setting it.
//   VITE_API_URL    — absolute URL of the FastAPI backend. Empty (default)
//                     means use the same origin, which the dev proxy turns
//                     into http://localhost:8000. Set this when the frontend
//                     is on GH Pages and the backend is on Railway.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';
  return {
    base,
    plugins: [react()],
    resolve: {
      alias: {
        '@engine': path.resolve(__dirname, 'engine'),
        '@data': path.resolve(__dirname, 'data'),
        '@': path.resolve(__dirname, 'src'),
      },
    },
    server: {
      proxy: {
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react')) return 'vendor-react';
            if (id.includes('/engine/')) return 'arcade-engine';
            // Per-pool dynamic imports stay individual chunks — we deliberately
            // do NOT group them, so a player on the WC route doesn't download
            // EPL + NBA + NFL + MLB pools they'll never touch.
          },
        },
      },
    },
  };
});
