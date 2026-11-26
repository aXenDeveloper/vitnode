import { useMessages } from 'use-intl'

export interface PagesCopy {
  article: { back: string; body: string; read: string }
  blog: {
    all: string
    articles: { date: string; title: string }[]
    categories: string
    categoryNames: string[]
    desc: string
    title: string
  }
  discover: { commented: string; desc: string; kind: string; title: string }
  forum: {
    comments: string
    desc: string
    forums: { desc?: string; latest: string; name: string }[]
    latest: string
    newTopic: string
    title: string
    topics: string
    topicsList: { date: string; title: string }[]
  }
  modcp: {
    assigned: string
    cards: { kind: string; reason: string; text: string }[]
    columns: string[]
    crumb: string
    desc: string
    empty: string
    nav: string[]
    search: string
    title: string
  }
  nav: {
    blog: string
    community: string
    docs: string
    login: string
    plugins: string
    register: string
    search: string
  }
  notifications: {
    items: { text: string; time: string }[]
    markAll: string
    tabs: string[]
    title: string
  }
  payments: {
    desc: string
    item: string
    itemDesc: string
    owned: string
    price: string
    title: string
    view: string
  }
  people: { name: string; nick: string }[]
  profile: {
    joined: string
    month: string
    online: string
    reacted: string
    reputation: string
    role: string
    timeline: string
    today: string
    weekday: string
    weekdayBefore: string
    yesterday: string
  }
  search: {
    any: string
    content: string
    date: string
    desc: string
    filters: string
    kinds: string[]
    newest: string
    placeholder: string
    ranges: string[]
    results: string
    title: string
  }
  topic: {
    body: string
    commentCount: string
    comments: string[]
    hide: string
    posted: string
    report: string
  }
}

type Raw = boolean | number | string | { [key: string]: Raw }
type Listed = boolean | Listed[] | number | string | { [key: string]: Listed }

const cache = new WeakMap<object, Listed>()

const isIndexed = (keys: string[]) =>
  keys.length > 0 && keys.every((key, index) => key === String(index))

const toLists = (value: Raw): Listed => {
  if (typeof value !== 'object') return value

  const cached = cache.get(value)

  if (cached) return cached

  const keys = Object.keys(value)
  const listed: Listed = isIndexed(keys)
    ? keys.map((key) => toLists(value[key] ?? ''))
    : Object.fromEntries(keys.map((key) => [key, toLists(value[key] ?? '')]))

  cache.set(value, listed)

  return listed
}

export const usePages = () => {
  const messages = useMessages() as unknown as {
    site: { home: { hero: { pages: Raw } } }
  }

  return toLists(messages.site.home.hero.pages) as unknown as PagesCopy
}
