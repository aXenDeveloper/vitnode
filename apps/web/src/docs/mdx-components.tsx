import type { MDXComponents } from 'mdx/types'

import { Step, Steps } from 'fumadocs-ui/components/steps'
import defaultMdxComponents from 'fumadocs-ui/mdx'

import { Callout } from './callout'
import { Preview } from './preview'

export const getMDXComponents = (components?: MDXComponents) =>
  ({
    ...defaultMdxComponents,
    Callout,
    Preview,
    Step,
    Steps,
    ...components,
  }) satisfies MDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
