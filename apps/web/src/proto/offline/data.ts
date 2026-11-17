import type { RichTextDocument } from '@vitnode/core/components/rich-text'

export type Scenario = 'done' | 'far' | 'none' | 'soon'

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 'soon', label: '2d' },
  { id: 'far', label: '128d' },
  { id: 'done', label: 'Soon' },
  { id: 'date', label: 'Date only' },
  { id: 'none', label: 'None' },
]

const OFFSETS: Record<Scenario, null | number> = {
  date: (2 * 24 * 3600 + 5 * 3600 + 37 * 60 + 12) * 1000,
  done: -60_000,
  far: (128 * 24 * 3600 + 3 * 3600 + 7 * 60 + 9) * 1000,
  none: null,
  soon: (2 * 24 * 3600 + 5 * 3600 + 37 * 60 + 12) * 1000,
}

export const opensAtFor = (scenario: Scenario, now: number): null | string => {
  const offset = OFFSETS[scenario]

  return offset === null ? null : new Date(now + offset).toISOString()
}

/** Worst realistic content: two paragraphs, a bold run and a link. */
export const MESSAGE: RichTextDocument = {
  content: [
    {
      content: [
        {
          text: "We're moving the forum to a faster server and upgrading the search index along the way. Your posts, private messages and uploads are safe - nothing is being deleted.",
          type: 'text',
        },
      ],
      type: 'paragraph',
    },
    {
      content: [
        { text: 'Signing in, notifications and ', type: 'text' },
        { marks: [{ type: 'bold' }], text: 'the marketplace', type: 'text' },
        { text: ' will be back first. Follow ', type: 'text' },
        {
          marks: [
            { attrs: { href: 'https://status.example.com' }, type: 'link' },
          ],
          text: 'status.example.com',
          type: 'text',
        },
        { text: ' for live updates.', type: 'text' },
      ],
      type: 'paragraph',
    },
  ],
  type: 'doc',
}
