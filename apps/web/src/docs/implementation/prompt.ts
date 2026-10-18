import type { DocsImplementation } from './schema'

export interface ImplementationPromptInput {
  implementation: DocsImplementation
  /** Path of the guide's Markdown twin, such as `/docs/dev/fetcher.md`. */
  markdownUrl: string
  /** Absolute origin the links point at, such as `https://vitnode.com`. */
  origin: string
  title: string
  /** Path of the guide, such as `/docs/dev/fetcher`. */
  url: string
}

const toMarkdownPath = (path: string) => {
  const page = path.split('#')[0] ?? path

  return `${page}.md`
}

const absolute = (origin: string, path: string) => new URL(path, origin).href

const list = (items: readonly string[], numbered = false) =>
  items
    .map((item, index) => `${numbered ? `${index + 1}.` : '-'} ${item}`)
    .join('\n')

/**
 * Builds the prompt behind "Copy implementation prompt": the shared agent
 * workflow plus the guide's own decisions and constraints. Pure, so the same
 * input always gives the same text.
 */
export const buildImplementationPrompt = ({
  implementation: { constraints = [], decisions, objective, related = [] },
  markdownUrl,
  origin,
  title,
  url,
}: ImplementationPromptInput): string => {
  const links = [
    `- Guide: ${absolute(origin, url)}`,
    `- Guide as Markdown: ${absolute(origin, markdownUrl)}`,
    ...related.map(
      (link) =>
        `- ${link.title}: ${absolute(origin, link.href)} (Markdown: ${absolute(origin, toMarkdownPath(link.href))})`,
    ),
  ]

  const sections = [
    `# Implement in my VitNode project: ${title}`,
    `Objective: ${objective}`,
    'You are a coding agent working in my project. Use the VitNode guide below as the technical reference, find where this feature belongs in my project, settle the open choices with me, then implement it.',
    `## Documentation\n\n${links.join('\n')}`,
    `## 1. Read the guide and inspect the project (no edits yet)\n\n${list([
      'Read the guide as Markdown before changing anything. If you cannot open it, tell me instead of working from memory.',
      'Follow the project instructions, such as AGENTS.md or CLAUDE.md.',
      'Check the installed VitNode version (`@vitnode/core` in package.json and the lockfile) and the conventions the project already uses.',
      'Find the plugins, modules, content types, routes and UI components that matter for this task.',
      "The guide's example plugin and names show the technique. They are not the target: integrate into what this project contains.",
      'If the guide and the installed code differ, inspect the installed implementation (its types and exports), never invent an API, and tell me about any material difference.',
    ])}`,
    `## 2. Ask a short questionnaire before editing\n\nSettle these decisions with me before you edit files:\n\n${list(decisions, true)}\n\nHow to ask:\n\n${list(
      [
        'Skip a decision I already answered in this conversation, or one the project settles beyond doubt, such as a single possible target. Say what you assumed.',
        'Offer concrete choices you found in the project. Never present an invented plugin, module or content type as a discovered choice.',
        'Recommend one choice when there is a clear reason, and let me pick another.',
        'Use the names I see in the interface, such as "Topics" or "Comments", and map them to technical ids yourself.',
        'Ask only what changes the implementation. Do not ask for paths, imports, identifiers or other details you can find in the code.',
        'Ask independent questions together in one short round. Ask a dependent question after its answer, for example offer content types only from the plugin I chose.',
        'Use a structured question tool if you have one. Otherwise ask in plain text with short numbered options I can answer by number.',
        'If the project has nothing that fits a decision, explain the gap and ask how to proceed. Never pick an ambiguous target silently.',
      ],
    )}`,
    `## 3. Implement\n\n${list([
      'When the required answers are in, state the resulting scope in two or three lines and start. Do not ask for another confirmation.',
      'Reuse the existing VitNode features, permissions and UI conventions instead of building parallel ones.',
      'Complete the server part and the public UI integration the guide describes, for the chosen target.',
      'Keep the change focused on this task and preserve unrelated work, including uncommitted changes.',
      "Run the project's existing checks that apply, such as type checking, linting, tests and the build.",
    ])}`,
    ...(constraints.length > 0
      ? [`Rules for this feature:\n\n${list(constraints)}`]
      : []),
    `## 4. Report\n\n${list([
      'What changed, by file, and the behavior I can now see.',
      'Which checks you ran and their results.',
      'Anything unresolved, including differences between the guide and the installed VitNode version.',
    ])}`,
  ]

  return `${sections.join('\n\n')}\n`
}
