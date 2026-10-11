import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Kafa'a is mounted at /kafaa/ on the NEXUS site. Hashed assets land under /kafaa/assets/
// so they can never collide with NEXUS's own /assets/ files.
export default defineConfig({
  base: '/kafaa/',
  plugins: [react()],
  build: {
    outDir: 'dist/kafaa',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
