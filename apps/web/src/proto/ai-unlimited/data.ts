export interface ProtoFeature {
  dailyLimit: null | number
  icon: string
  key: string
  monthPoints: number
  title: string
  usedToday: number
}

export interface ProtoUsage {
  features: ProtoFeature[]
  periodStart: Date
  resetsAt: Date
  used: number
}

const periodStart = new Date(2026, 9, 1)
const resetsAt = new Date(2026, 10, 1)

const heavy: ProtoFeature[] = [
  { dailyLimit: 20, icon: 'text-quote', key: 'summarize', monthPoints: 612.4, title: 'Summarize thread', usedToday: 14 },
  { dailyLimit: null, icon: 'languages', key: 'translate', monthPoints: 388.9, title: 'Translate article into another language while keeping the formatting', usedToday: 9 },
  { dailyLimit: 10, icon: 'wand-sparkles', key: 'rewrite', monthPoints: 171.2, title: 'Rewrite with a friendlier tone', usedToday: 10 },
  { dailyLimit: 50, icon: 'image', key: 'alt', monthPoints: 64.3, title: 'Generate alt text', usedToday: 3 },
  { dailyLimit: null, icon: 'tags', key: 'tags', monthPoints: 31.6, title: 'Suggest tags', usedToday: 1 },
  { dailyLimit: null, icon: 'message-square-reply', key: 'reply', monthPoints: 16.2, title: 'Draft reply', usedToday: 0 },
]

const light: ProtoFeature[] = [
  { dailyLimit: 20, icon: 'text-quote', key: 'summarize', monthPoints: 0.2, title: 'Summarize thread', usedToday: 1 },
  { dailyLimit: null, icon: 'languages', key: 'translate', monthPoints: 0.1, title: 'Translate article into another language while keeping the formatting', usedToday: 0 },
  { dailyLimit: 10, icon: 'wand-sparkles', key: 'rewrite', monthPoints: 0, title: 'Rewrite with a friendlier tone', usedToday: 0 },
]

const fresh: ProtoFeature[] = light.map(feature => ({ ...feature, monthPoints: 0, usedToday: 0 }))

const build = (features: ProtoFeature[]): ProtoUsage => ({
  features,
  periodStart,
  resetsAt,
  used: features.reduce((sum, feature) => sum + feature.monthPoints, 0),
})

export const SCENARIOS = {
  heavy: { label: 'Heavy use', usage: build(heavy) },
  light: { label: 'Light use (0.3 pts)', usage: build(light) },
  fresh: { label: 'Nothing used yet', usage: build(fresh) },
} as const

export type ScenarioKey = keyof typeof SCENARIOS

export const formatPoints = (value: number) => {
  if (value > 0 && value < 0.1) return '<0.1'
  return new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(Math.floor(value * 10) / 10)
}

export const formatDay = (date: Date) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long' }).format(date)

export const runsToday = (usage: ProtoUsage) =>
  usage.features.reduce((sum, feature) => sum + feature.usedToday, 0)

export const usedFeatures = (usage: ProtoUsage) =>
  [...usage.features].filter(feature => feature.monthPoints > 0).sort((a, b) => b.monthPoints - a.monthPoints)
