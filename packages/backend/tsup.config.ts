import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['scripts/setup.ts'],
  outDir: 'dist/scripts',
  clean: false,
  minify: true,
});
