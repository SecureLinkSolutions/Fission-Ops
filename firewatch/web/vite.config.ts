import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, run `npm start` (the data server, port 8787) alongside `npm run dev`.
export default defineConfig({
  root: 'web',
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      '/data': 'http://localhost:8787',
      '/api': 'http://localhost:8787',
    },
  },
});
