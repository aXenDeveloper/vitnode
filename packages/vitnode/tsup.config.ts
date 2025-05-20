import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['scripts/scripts.ts'],
  outDir: 'dist/scripts',
  clean: false,
  minify: true,
  splitting: true,
  format: 'esm',
  target: 'esnext',
  platform: 'node',
  noExternal: ['fs'],
  banner: {
    js: `import 'tsx/esm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
});
