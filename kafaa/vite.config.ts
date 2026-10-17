import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Kafa'a is mounted at /kafaa/ on the NEXUS site. Hashed assets land under /kafaa/assets/
// so they can never collide with NEXUS's own /assets/ files.
export default defineConfig({
  base: '/kafaa/',
  plugins: [react()],
  // JSON modules become JSON.parse('...'): much cheaper to transform and to parse than an object literal, which matters for the
  // 25 MB seed.json (local backend chunk) and for every unit test that loads it (TECH-02). Default imports only (none are named).
  json: { stringify: true },
  build: {
    outDir: 'dist/kafaa',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173 },
  preview: { port: 4173 },
});
