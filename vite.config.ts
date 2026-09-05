import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * `BASE_PATH` lets the same build serve from the root (Docker / local preview)
 * and from `/<repo>/` on GitHub Pages.
 */
export default defineConfig(() => ({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          table: ['@tanstack/react-table', '@tanstack/react-virtual'],
          markdown: ['marked', 'dompurify'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
}));
