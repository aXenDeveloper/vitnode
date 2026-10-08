import { SOLUTION_SLUGS, solutionPath } from './solutions/catalog.ts'

export const PRERENDERED_PATHS = [
  '/',
  '/plugins',
  '/solutions',
  ...SOLUTION_SLUGS.map(solutionPath),
]
