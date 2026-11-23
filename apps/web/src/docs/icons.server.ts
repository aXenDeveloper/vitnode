import '@tanstack/react-start/server-only'

import type { Node, Root } from 'fumadocs-core/page-tree'

import { visit } from 'fumadocs-core/page-tree'
import dynamicIconImports from 'lucide-react/dynamicIconImports.mjs'

import type { DocsIconNode, DocsPageTreeIcons } from './page-tree'

const toComponentName = (iconName: string) =>
  iconName.replace(/(?:^|-)(\w)/g, (_, char: string) => char.toUpperCase())

const iconImports = new Map(
  Object.entries(dynamicIconImports).map(([name, load]) => [
    toComponentName(name),
    load,
  ]),
)

const toDocsIconNode = (
  node: readonly (readonly [string, object, ...unknown[]])[],
): DocsIconNode =>
  node.map(([tag, attributes]) => [
    tag,
    Object.fromEntries(
      Object.entries(attributes).map(([name, value]) => [name, String(value)]),
    ),
  ])

const iconNamesOf = (tree: Root) => {
  const names = new Set<string>()

  visit(tree, (node) => {
    if ('icon' in node && typeof node.icon === 'string') names.add(node.icon)
  })

  return names
}

export const loadDocsPageTreeIcons = async (
  tree: Root,
): Promise<DocsPageTreeIcons> => {
  const entries = await Promise.all(
    [...iconNamesOf(tree)].map(async (name) => {
      const load = iconImports.get(name)

      if (!load) {
        // oxlint-disable-next-line no-console
        console.warn(`[docs] Unknown Lucide icon in the page tree: ${name}`)

        return []
      }

      return [[name, toDocsIconNode((await load()).__iconData.node)] as const]
    }),
  )

  return Object.fromEntries(entries.flat())
}

const treePathOf = (nodes: readonly Node[], url: string): Node[] | null => {
  for (const node of nodes) {
    if (node.type === 'page' && node.url === url) return [node]
    if (node.type !== 'folder') continue
    if (node.index?.url === url) return [node, node.index]

    const path = treePathOf(node.children, url)
    if (path) return [node, ...path]
  }

  return null
}

export const docsSectionTitle = (tree: Root, url: string) => {
  const [top] = treePathOf(tree.children, url) ?? []

  return top?.type === 'folder' && top.root && typeof top.name === 'string'
    ? top.name
    : undefined
}
