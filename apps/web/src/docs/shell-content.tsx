import type { Root } from 'fumadocs-core/page-tree'

import { Link, useRouterState } from '@tanstack/react-router'
import { MainHeader } from '@vitnode/core/tanstack/layout'
import { cn } from 'cn'
import { DocsLayout } from 'fumadocs-ui/layouts/spacious'
import {
  Sidebar,
  SidebarDrawer,
  SidebarProvider,
} from 'fumadocs-ui/layouts/spacious/slots/sidebar'
import { RootProvider } from 'fumadocs-ui/provider/tanstack'
import { BookOpenIcon } from 'lucide-react'
import React from 'react'

import { docsSearchSource } from './search-source'
import { docsSectionOf } from './section'
import { DocsSidebarToggle } from './sidebar-toggle'

const DocsNavTitle = ({ className }: React.ComponentProps<'a'>) => (
  <Link className={className} to="/docs">
    <BookOpenIcon aria-hidden className="text-fd-muted-foreground size-4" />
    Documentation
  </Link>
)

const DocsSidebarProvider = ({
  children,
  ...props
}: React.ComponentProps<typeof SidebarProvider>) => (
  <SidebarProvider {...props}>
    <MainHeader
      firstSearchSourceId={docsSearchSource.id}
      leading={<DocsSidebarToggle />}
      variant="bar"
    />
    {children}
  </SidebarProvider>
)

export const DocsShellContent = ({
  children,
  pageTree,
}: {
  children: React.ReactNode
  pageTree: Root
}) => {
  const section = useRouterState({
    select: (state) =>
      docsSectionOf((state.resolvedLocation ?? state.location).pathname),
  })

  return (
    <RootProvider search={{ enabled: false }} theme={{ enabled: false }}>
      {/*
       * The section accent, as a class on a wrapper rather than on `<html>`.
       * See `./section` for why that is now possible and what it replaces.
       */}
      <div className={cn('[--fd-banner-height:--spacing(14)]', section)}>
        <DocsLayout
          searchToggle={{ enabled: false }}
          slots={{
            navTitle: DocsNavTitle,
            sidebar: {
              drawer: SidebarDrawer,
              main: Sidebar,
              provider: DocsSidebarProvider,
            },
          }}
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
          themeSwitch={{ enabled: false }}
          tree={pageTree}
        >
          {children}
        </DocsLayout>
      </div>
    </RootProvider>
  )
}
