import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['scripts/scripts.ts'],
  outDir: 'dist/scripts',
  clean: false,
  minify: true,
});
