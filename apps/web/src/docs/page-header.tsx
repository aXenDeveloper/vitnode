import type { Folder } from 'fumadocs-core/page-tree'

import { buttonVariants } from '@vitnode/core/components/ui/button'
import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import { useTreePath } from 'fumadocs-ui/contexts/tree'
import {
  DocsDescription,
  DocsTitle,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/spacious/page'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

const markdownCache = new Map<string, string>()

const loadMarkdown = async (markdownUrl: string) => {
  const cached = markdownCache.get(markdownUrl)
  if (cached !== undefined) return cached

  const res = await fetch(markdownUrl)
  if (!res.ok) throw new Error(`Failed to load ${markdownUrl}: ${res.status}`)

  const markdown = await res.text()
  if (import.meta.env.PROD) markdownCache.set(markdownUrl, markdown)

  return markdown
}

const SectionPath = ({ folders }: { folders: Folder[] }) => (
  <p className="text-fd-primary flex flex-wrap items-center gap-1 text-sm font-medium [&_.fd-page-tree-item-name]:w-auto!">
    {folders.map((folder, index) => (
      <Fragment key={folder.$id ?? folder.index?.url}>
        {index > 0 && (
          <ChevronRight aria-hidden="true" className="size-3.5 opacity-60" />
        )}
        {folder.name}
      </Fragment>
    ))}
  </p>
)

const IconArtwork = ({ icon }: { icon: React.ReactNode }) => (
  <div
    aria-hidden="true"
    className="relative flex size-40 shrink-0 items-center justify-center select-none max-md:hidden"
  >
    <span className="border-fd-primary/10 absolute inset-0 rounded-4xl border" />
    <span className="border-fd-primary/15 bg-fd-primary/5 absolute inset-5 rounded-xl border" />
    <span className="bg-fd-background text-fd-primary relative flex size-20 items-center justify-center rounded-2xl border shadow-sm [&_svg]:size-9">
      {icon}
    </span>
  </div>
)

export const DocsPageHeader = ({
  description,
  githubUrl,
  markdownUrl,
  title,
}: {
  description?: string
  githubUrl: string
  markdownUrl: string
  title: string
}) => {
  const path = useTreePath()
  const icon = path.at(-1)?.icon
  const sectionPath = path.filter(
    (node): node is Folder => node.type === 'folder' && !node.root,
  )

  return (
    <header className="flex items-center gap-10 border-b pt-2 pb-10">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {(icon || sectionPath.length > 0) && (
          <div className="flex items-center gap-3">
            {icon && (
              <span
                aria-hidden="true"
                className="bg-fd-background text-fd-primary flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-xs md:hidden [&_svg]:size-5"
              >
                {icon}
              </span>
            )}
            {sectionPath.length > 0 && <SectionPath folders={sectionPath} />}
          </div>
        )}
        <DocsTitle className="text-3xl tracking-tight text-balance md:text-4xl">
          {title}
        </DocsTitle>
        <DocsDescription className="mb-0 text-lg leading-relaxed text-pretty">
          {description}
        </DocsDescription>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CopyButton
            content={async () => await loadMarkdown(markdownUrl)}
            size="sm"
            variant="secondary"
          >
            Copy Markdown
          </CopyButton>
          <ViewOptionsPopover
            className={buttonVariants({ size: 'sm', variant: 'secondary' })}
            githubUrl={githubUrl}
            markdownUrl={markdownUrl}
          />
        </div>
      </div>
      {icon && <IconArtwork icon={icon} />}
    </header>
  )
}
