import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 1420,
    strictPort: true
  },
  clearScreen: false,
  // Bundle Monaco Editor workers locally instead of downloading from CDN.
  // This is the key fix for offline support and fast file opening.
  worker: {
    format: 'es'
  }
});
