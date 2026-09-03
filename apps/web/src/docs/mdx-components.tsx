import { Step, Steps } from 'fumadocs-ui/components/steps'
import defaultMdxComponents from 'fumadocs-ui/mdx'

import { Preview } from './preview'

/**
 * The components every document is rendered with - one map, in one module.
 *
 * Fumadocs' defaults carry the bulk of it: `Callout`, `Card`, `Cards`, the code
 * block and its tabs, the heading anchors, the table wrapper, and - the one that
 * matters most here - `a`, which is the framework link. That is why a Markdown
 * link like `[plugin routes](/docs/dev/plugins/routes)` becomes a
 * client-side navigation that keeps the locale prefix: the anchor resolves
 * through `fumadocs-core/framework/tanstack`, which renders TanStack Router's
 * own `<Link>`, which builds its href through this app's `rewrite`. There is no
 * link adapter in this application and there must not be one - see
 * `src/routes/_docs.tsx`.
 *
 * Three additions on top, and they are the same three the Next.js application
 * added:
 *
 * - `Steps` / `Step`, used by 48 documents, which Fumadocs ships but does not
 *   include in the default map.
 * - `Preview`, which is this site's own: a live rendering of a VitNode component
 *   beside the prose describing it.
 *
 * `TypeTable`, `Tabs`/`Tab` and `ImgDocs` are deliberately absent. A document
 * that needs one imports it at the top of its own MDX file, which is how they
 * were written and how they stay: a component used by a dozen pages does not
 * need to be in the map every page pays for.
 *
 * Declared once and exported, rather than built inline in the route: the Next.js
 * page assembled this object in its render, and a second copy appearing in a
 * second route is exactly the drift this stage is meant to prevent.
 */
export const mdxComponents = {
  ...defaultMdxComponents,
  Preview,
  Step,
  Steps,
}
