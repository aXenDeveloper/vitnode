import type { Root } from 'fumadocs-core/page-tree'
import type { SerializedPageTree } from 'fumadocs-core/source/client'

import { deserializePageTree } from 'fumadocs-core/source/client'
import { Icon } from 'lucide-react'
import React from 'react'

export type DocsIconNode = [tag: string, attributes: Record<string, string>][]

export type DocsPageTreeIcons = Record<string, DocsIconNode>

const iconElement = (iconNode: DocsIconNode | undefined) =>
  iconNode ? (
    <span>
      <Icon iconNode={iconNode} />
    </span>
  ) : undefined

const withIconElements = (node: object, icons: DocsPageTreeIcons): object =>
  Object.fromEntries(
    Object.entries(node).map(([key, value]: [string, unknown]) => {
      if (key === 'icon' && typeof value === 'string') {
        return [key, iconElement(icons[value])]
      }

      if (Array.isArray(value)) {
        return [
          key,
          value.map((item: unknown) =>
            typeof item === 'object' && item !== null
              ? withIconElements(item, icons)
              : item,
          ),
        ]
      }

      return [
        key,
        typeof value === 'object' && value !== null
          ? withIconElements(value, icons)
          : value,
      ]
    }),
  )

export const useDocsPageTree = (
  pageTree: SerializedPageTree,
  icons: DocsPageTreeIcons,
): Root =>
  React.useMemo(
    () =>
      deserializePageTree({
        ...pageTree,
        data: withIconElements(pageTree.data, icons),
      }),
    [pageTree, icons],
  )
