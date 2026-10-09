import type { Root } from 'fumadocs-core/page-tree'

import { useRouterState } from '@tanstack/react-router'
import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import { LOGO_VIEW_TRANSITION_NAME } from '@vitnode/core/tanstack/view-transitions'
import { cn } from 'cn'
import { DocsLayout, useSpaciousLayout } from 'fumadocs-ui/layouts/spacious'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import React, { useId } from 'react'

import { docsSectionOf } from './section'

const DocsSearchDialog = React.lazy(async () => await import('./search-dialog'))

const DocsNavTitle = () => {
  const logoId = useId()

  return (
    <LogoVitNode
      className="w-30"
      idPrefix={logoId}
      style={{ viewTransitionName: LOGO_VIEW_TRANSITION_NAME }}
    />
  )
}

const DocsActions = ({ className, ...props }: React.ComponentProps<'div'>) => {
  const { menuItems } = useSpaciousLayout()

  return (
    <div className={cn('flex items-center gap-1', className)} {...props}>
      {menuItems.map(
        (item) =>
          item.type === 'icon' && (
            <a
              aria-label={item.label}
              className="text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:ring-fd-ring inline-flex items-center justify-center rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none [&_svg]:size-4.5"
              href={item.url}
              key={item.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {item.icon}
            </a>
          ),
      )}
      <ThemeSwitcher />
    </div>
  )
}

export const DocsShellContent = ({
  children,
  pageTree,
}: {
  children: React.ReactNode
  pageTree: Root
}) => {
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
          nav={{ title: <DocsNavTitle /> }}
          slots={{ actions: DocsActions, themeSwitch: ThemeSwitcher }}
          tabs={{
            transform(option) {
              const tab = docsSectionOf(option.url)
              if (!(tab && option.icon)) return option

              const color = `var(--${tab}-color, var(--color-fd-foreground))`

              return {
                ...option,
                icon: (
                  <div
                    className="text-(--tab-color)"
                    style={{ '--tab-color': color } as React.CSSProperties}
                  >
                    {option.icon}
                  </div>
                ),
              }
            },
          }}
          tree={pageTree}
        >
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  )
}
