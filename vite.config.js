import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0, chunkSizeWarningLimit: 1200,
    rollupOptions: { input: { main: 'index.html', kitchen: 'kitchen.html', tables: 'tables.html' } } },
  server: { port: 5310 },
});
