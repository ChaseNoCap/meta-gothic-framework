import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'QualityService',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['pg', 'crypto', 'fs', 'path', 'url'],
    },
    target: 'node20',
    outDir: 'dist',
    emptyOutDir: true
  }
});