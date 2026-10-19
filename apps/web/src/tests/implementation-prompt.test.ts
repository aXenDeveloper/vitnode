import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { ImplementationPromptInput } from '../docs/implementation/prompt.ts'

import { buildImplementationPrompt } from '../docs/implementation/prompt.ts'

const origin = 'https://docs.example.com'

const input: ImplementationPromptInput = {
  implementation: {
    constraints: [
      'Use the `thread` option.',
      'Create the table with migrations.',
    ],
    decisions: [
      'Which plugin owns the replies?',
      'Which items get replies?',
      'How deep can replies nest?',
    ],
    objective: 'Add threaded replies under an existing content type.',
    related: [
      { href: '/docs/content-engine/public-write', title: 'Public write' },
      {
        href: '/docs/content-engine/reference#thread',
        title: 'Thread reference',
      },
    ],
  },
  markdownUrl: '/docs/content-engine/threads.md',
  origin,
  title: 'Threaded replies',
  url: '/docs/content-engine/threads',
}

const minimal: ImplementationPromptInput = {
  ...input,
  implementation: {
    decisions: ['Which plugin owns the replies?'],
    objective: 'Add threaded replies under an existing content type.',
  },
}

const absoluteUrls = (prompt: string) =>
  (prompt.match(/https:\/\/[^\s)]+/g) ?? []).map((href) => new URL(href))

describe('buildImplementationPrompt', () => {
  it('returns the same text for the same input', () => {
    assert.equal(
      buildImplementationPrompt(input),
      buildImplementationPrompt(structuredClone(input)),
    )
  })

  it('lists the decisions numbered in order and the constraints', () => {
    const prompt = buildImplementationPrompt(input)

    assert.ok(
      prompt.includes(
        '1. Which plugin owns the replies?\n2. Which items get replies?\n3. How deep can replies nest?',
      ),
    )
    assert.ok(
      prompt.includes(
        'Rules for this feature:\n\n- Use the `thread` option.\n- Create the table with migrations.',
      ),
    )
  })

  it('leaves out the rules block and related links when the page has none', () => {
    const prompt = buildImplementationPrompt(minimal)

    assert.ok(!prompt.includes('Rules for this feature'))
    assert.deepEqual(
      absoluteUrls(prompt).map((url) => url.href),
      [
        `${origin}/docs/content-engine/threads`,
        `${origin}/docs/content-engine/threads.md`,
      ],
    )
  })

  it('points every link at the given origin and drops the anchor only from Markdown links', () => {
    const prompt = buildImplementationPrompt(input)
    const urls = absoluteUrls(prompt)

    assert.deepEqual(
      urls.map((url) => url.href),
      [
        `${origin}/docs/content-engine/threads`,
        `${origin}/docs/content-engine/threads.md`,
        `${origin}/docs/content-engine/public-write`,
        `${origin}/docs/content-engine/public-write.md`,
        `${origin}/docs/content-engine/reference#thread`,
        `${origin}/docs/content-engine/reference.md`,
      ],
    )
    for (const url of urls) {
      assert.equal(url.origin, origin)
    }
  })

  it('tells the agent to resolve ambiguity before editing files', () => {
    const prompt = buildImplementationPrompt(input)

    for (const phrase of [
      'Settle these decisions with me before you edit files',
      'Never pick an ambiguous target silently',
      'Skip a decision I already answered',
      'Otherwise ask in plain text with short numbered options',
    ]) {
      assert.ok(prompt.includes(phrase), `missing: ${phrase}`)
    }
  })
})
