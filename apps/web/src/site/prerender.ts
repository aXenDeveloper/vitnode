import { COMPARE_SLUGS, comparePath } from './compare/catalog.ts'
import { PLATFORM_SLUGS, platformPath } from './platform/catalog.ts'
import { SOLUTION_SLUGS, solutionPath } from './solutions/catalog.ts'

export const PRERENDERED_PATHS = [
  '/',
  '/plugins',
  '/solutions',
  ...SOLUTION_SLUGS.map(solutionPath),
  '/compare',
  ...COMPARE_SLUGS.map(comparePath),
  '/why-vitnode',
  '/platform',
  ...PLATFORM_SLUGS.map(platformPath),
  '/integrations',
  '/extensions',
]
