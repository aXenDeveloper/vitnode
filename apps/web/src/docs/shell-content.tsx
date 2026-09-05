import type { SerializedPageTree } from 'fumadocs-core/source/client'

import { useRouterState } from '@tanstack/react-router'
import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import { deserializePageTree } from 'fumadocs-core/source/client'
import { DocsLayout } from 'fumadocs-ui/layouts/notebook'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import React from 'react'

import { docsSectionOf } from './section'

const DocsSearchDialog = React.lazy(async () => await import('./search-dialog'))

export const DocsShellContent = ({
  children,
  pageTree,
}: {
  children: React.ReactNode
  pageTree: SerializedPageTree
}) => {
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
