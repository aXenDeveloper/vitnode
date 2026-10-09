import vitnode, { ignorePatterns } from '@vitnode/config/oxlint'
import vitnodeReact from '@vitnode/config/oxlint.react'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [vitnode, vitnodeReact],
  ignorePatterns: [
    ...ignorePatterns,
    '.nitro/**',
    '.output/**',
    '.tanstack/**',
    'dist/**',
    'src/*.gen.ts',
    'scripts/**',
  ],
  overrides: [
    {
      files: ['src/tests/**/*.ts'],
      rules: {
        'typescript/no-floating-promises': [
          'error',
          {
            allowForKnownSafeCalls: [
              {
                from: 'package',
                name: ['describe', 'it', 'test'],
                package: 'node:test',
              },
            ],
          },
        ],
      },
    },
  ],
})
