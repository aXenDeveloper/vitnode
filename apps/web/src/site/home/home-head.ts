import type { AbstractIntlMessages } from 'use-intl'

export const HOME_FAQ_KEYS = [
  'what',
  'free',
  'forum_blog',
  'self_hosted',
  'developer',
  'production',
  'different',
] as const

export interface HomeFaqEntry {
  answer: string
  question: string
}

type MessageNode = AbstractIntlMessages | string | undefined

const childOf = (node: MessageNode, key: string): MessageNode =>
  typeof node === 'object' ? node[key] : undefined

const textAt = (messages: AbstractIntlMessages, path: readonly string[]) => {
  const value = path.reduce<MessageNode>(childOf, messages)

  return typeof value === 'string' ? value : undefined
}

const homeFaqEntries = (messages: AbstractIntlMessages): HomeFaqEntry[] =>
  HOME_FAQ_KEYS.flatMap((key) => {
    const base = ['site', 'home', 'faq', 'items', key]
    const question = textAt(messages, [...base, 'question'])
    const answer = textAt(messages, [...base, 'answer'])

    return question && answer ? [{ answer, question }] : []
  })

export interface HomeHeadData {
  description?: string
  faq: HomeFaqEntry[]
  title?: string
}

export const homeHeadData = (messages: AbstractIntlMessages): HomeHeadData => ({
  description: textAt(messages, ['site', 'home', 'hero', 'meta_description']),
  faq: homeFaqEntries(messages),
  title: textAt(messages, ['site', 'home', 'hero', 'meta_title']),
})

export const faqPageNode = (entries: readonly HomeFaqEntry[]) => ({
  '@type': 'FAQPage',
  mainEntity: entries.map(({ answer, question }) => ({
    '@type': 'Question',
    acceptedAnswer: { '@type': 'Answer', text: answer },
    name: question,
  })),
})
