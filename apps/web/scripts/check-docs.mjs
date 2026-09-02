import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const docsRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '../content/docs',
)
const errors = []

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? await walk(path) : [path]
    }),
  )

  return files.flat()
}

const frontmatterValue = (frontmatter, field) => {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '')
}

const checkFrontmatter = (file, source) => {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)

  if (!match) {
    errors.push(`${file}: missing frontmatter`)
    return
  }

  const title = frontmatterValue(match[1], 'title')
  const description = frontmatterValue(match[1], 'description')
  const icon = frontmatterValue(match[1], 'icon')

  for (const [field, value] of [
    ['title', title],
    ['description', description],
    ['icon', icon],
  ]) {
    if (!value) errors.push(`${file}: missing ${field}`)
  }

  if (description && (description.length < 50 || description.length > 170)) {
    errors.push(
      `${file}: description should be 50–170 characters for search snippets`,
    )
  }
}

const checkCategory = (file, source) => {
  let category

  try {
    category = JSON.parse(source)
  } catch {
    errors.push(`${file}: invalid JSON`)
    return
  }

  for (const field of ['title', 'description', 'icon']) {
    if (!category[field]) errors.push(`${file}: missing ${field}`)
  }

  if (
    category.description &&
    (category.description.length < 35 || category.description.length > 170)
  ) {
    errors.push(
      `${file}: description should be 35–170 characters for navigation and search`,
    )
  }
}

const checkPackageManagerTabs = (file, source) => {
  const tabs = [...source.matchAll(/<Tabs\b[\s\S]*?<\/Tabs>/g)]
  const blocks = source.matchAll(
    /^```(?:bash|sh|shell|zsh)([^\n]*)\n([\s\S]*?)^```/gm,
  )
  const checkedTabs = new Set()

  for (const block of blocks) {
    const [, _info, body] = block
    if (!/\b(?:bun|pnpm|npm)\b/.test(body)) continue

    const start = block.index ?? -1
    const container = tabs.find((tab) => {
      const tabStart = tab.index ?? -1
      return start >= tabStart && start < tabStart + tab[0].length
    })

    if (!container) {
      errors.push(
        `${file}: package-manager command needs Bun, pnpm, and npm tabs`,
      )
      continue
    }

    const key = container.index ?? -1
    if (checkedTabs.has(key)) continue
    checkedTabs.add(key)

    const labels = new Set(
      [...container[0].matchAll(/```[^\n]*\btab=["']([^"']+)["']/g)].map(
        (tab) => tab[1],
      ),
    )
    const missing = ['bun', 'pnpm', 'npm'].filter((label) => !labels.has(label))

    if (missing.length > 0) {
      errors.push(
        `${file}: package-manager tabs are missing ${missing.join(', ')}`,
      )
    }
  }
}

const files = await walk(docsRoot)

for (const file of files) {
  if (!file.endsWith('.mdx') && !file.endsWith('meta.json')) continue

  const source = await readFile(file, 'utf8')
  if (file.endsWith('.mdx')) {
    checkFrontmatter(file, source)
    checkPackageManagerTabs(file, source)
  } else {
    checkCategory(file, source)
  }
}

if (errors.length > 0) {
  console.error(`Docs check found ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Docs check passed for ${files.length} files.`)
}
