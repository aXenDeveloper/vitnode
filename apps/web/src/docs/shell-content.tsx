import type { SerializedPageTree } from 'fumadocs-core/source/client'

import { useRouterState } from '@tanstack/react-router'
import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import { deserializePageTree } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import React from 'react'

import { docsSectionOf } from './section'

/**
 * The search dialog, fetched when somebody opens it.
 *
 * `React.lazy` rather than a plain import because the dialog is the one part of
 * the docs chrome nobody sees until they press `⌘K`, and it carries the search
 * client with it. Fumadocs renders its `SearchDialog` slot inside a boundary of
 * its own, so no `Suspense` is needed around this.
 */
const DocsSearchDialog = React.lazy(async () => await import('./search-dialog'))

/**
 * The documentation's own application shell: the Fumadocs providers, the top
 * navigation, the sidebar and the search dialog.
 *
 * A **separate shell from `_main`**, not a variation of it. The documentation
 * has a full navigation of its own - a top bar with the mark and the GitHub
 * link, a row of section tabs, a sidebar, a table of contents - and rendering
 * `MainHeader` above it would put two site headers, two search triggers and two
 * theme switchers on one page. So `_docs` sits beside `_main` and `_admin`
 * rather than under any of them, and this is what it renders.
 *
 * ## The Fumadocs providers are mounted here, and only here
 *
 * `fumadocs-ui/provider/tanstack` - never `.../provider/next`, which is a
 * different module for a different framework and is what a mechanical port of
 * the Next.js layout would have brought across. It supplies the framework
 * adapter (`Link`, `usePathname`, `useRouter`) that every Fumadocs component
 * reads, which is the whole reason a Markdown link inside a document behaves
 * like a router link and keeps its locale prefix.
 *
 * Mounting it **around the docs subtree rather than at the root** is the
 * difference between a front page that loads Fumadocs and one that does not. The
 * root document stays what Stage 14 left it: the VitNode providers, and nothing
 * a marketing page cannot justify. `src/tests/asset-graph.test.ts` holds that
 * line, by failing if the front page's own chunks contain Fumadocs at all.
 *
 * `theme={{ enabled: false }}` because VitNode ships its own theme provider -
 * mounted by `__root` - and two of them means two sources of truth for one
 * `<html class="dark">`. The switcher in the corner is VitNode's, handed to
 * Fumadocs through `slots.themeSwitch`, so the docs chrome drives the same state
 * as the rest of the site.
 */
export const DocsShellContent = ({
  children,
  pageTree,
}: {
  children: React.ReactNode
  pageTree: SerializedPageTree
}) => {
  /**
   * The tree, as elements again.
   *
   * `deserializePageTree` is Fumadocs' own: the icons and names crossed the wire
   * as HTML strings and it turns them back into nodes. Memoized on the payload
   * rather than run per render, because it walks every node in the tree.
   */
  const tree = React.useMemo(() => deserializePageTree(pageTree), [pageTree])
  const section = useRouterState({
    select: (state) => docsSectionOf(state.location.pathname),
  })

  return (
    <RootProvider
      search={{ SearchDialog: DocsSearchDialog }}
      theme={{ enabled: false }}
    >
      {/*
       * The section accent, as a class on a wrapper rather than on `<html>`.
       * See `./section` for why that is now possible and what it replaces.
       */}
      <div className={section}>
        <DocsLayout
          githubUrl="https://github.com/VitNode/vitnode"
          links={[
            { active: 'nested-url', text: 'Documentation', url: '/docs' },
          ]}
          nav={{ mode: 'top', title: <LogoVitNode className="w-30" /> }}
          sidebar={{
            tabs: {
              /**
               * Each section's tab icon, tinted with that section's own colour.
               *
               * The Next.js layout derived the colour from
               * `source.getNodeMeta(node)`, which is a *server* lookup into the
               * content index - unavailable here, and unnecessary: a tab's `url`
               * is `/docs/<section>`, which is the same answer by a shorter
               * route. Same rule, same three colours, and no content index in
               * the browser.
               */
              transform(option) {
                const tab = docsSectionOf(option.url)
                if (!(tab && option.icon)) return option

                const color = `var(--${tab}-color, var(--color-fd-foreground))`

                return {
                  ...option,
                  icon: (
                    <div
                      className="size-full rounded-lg max-md:border max-md:bg-(--tab-color)/10 max-md:p-1.5 [&_svg]:size-full"
                      style={
                        { '--tab-color': color, color } as React.CSSProperties
                      }
                    >
                      {option.icon}
                    </div>
                  ),
                }
              },
            },
          }}
          slots={{ themeSwitch: ThemeSwitcher }}
          tree={tree}
        >
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  )
}
