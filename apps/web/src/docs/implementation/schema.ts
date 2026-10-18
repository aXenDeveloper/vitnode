import { pageSchema } from 'fumadocs-core/source/schema'
import { z } from 'zod'

const hint = z.string().trim().min(1).max(300)

/**
 * Optional `implementation` frontmatter of a task-oriented guide. Its presence
 * shows "Copy implementation prompt" on the page; the shared agent workflow
 * lives in `prompt.ts`, so this holds only what is specific to the guide.
 */
export const docsImplementationSchema = z.strictObject({
  /** What the agent builds, in one line, without the guide's example names. */
  objective: z.string().trim().min(1).max(160),
  /**
   * Choices the agent settles with the user before editing, in the order they
   * depend on each other. Say which project evidence offers the choices.
   */
  decisions: z.array(hint).min(1).max(6),
  /** Feature rules the agent must keep, such as the API to reuse. */
  constraints: z.array(hint).max(6).optional(),
  /** Other public docs pages the agent may need, as `/docs/...` paths. */
  related: z
    .array(
      z.strictObject({
        href: z
          .string()
          .regex(
            /^\/docs(?:\/[a-z0-9-]+)+(?:#[a-z0-9-]+)?$/,
            'Use a docs path such as /docs/dev/fetcher or /docs/dev/fetcher#errors.',
          ),
        title: z.string().trim().min(1).max(80),
      }),
    )
    .max(4)
    .optional(),
})

export type DocsImplementation = z.infer<typeof docsImplementationSchema>

export const docsPageSchema = pageSchema.extend({
  implementation: docsImplementationSchema.optional(),
})
