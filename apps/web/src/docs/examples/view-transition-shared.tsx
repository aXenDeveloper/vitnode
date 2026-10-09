import { Button } from '@vitnode/core/components/ui/button'
import { ArrowLeftIcon } from 'lucide-react'
import React, { startTransition, ViewTransition } from 'react'

const PLUGINS = [
  {
    description: 'Articles, categories and a friendly editor.',
    id: 'blog',
    initial: 'B',
    title: 'Blog',
  },
  {
    description: 'Send email through any SMTP server.',
    id: 'nodemailer',
    initial: 'N',
    title: 'Nodemailer',
  },
  {
    description: 'Store uploads in any S3-compatible bucket.',
    id: 's3',
    initial: 'S',
    title: 'S3',
  },
] as const

type Plugin = (typeof PLUGINS)[number]

const Mark = ({ name, plugin }: { name: string; plugin: Plugin }) => (
  <ViewTransition name={`${name}-mark`} share="vt-morph-part">
    <span
      aria-hidden
      className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-lg text-base font-semibold"
    >
      {plugin.initial}
    </span>
  </ViewTransition>
)

const Title = ({ name, plugin }: { name: string; plugin: Plugin }) => (
  <ViewTransition name={`${name}-title`} share="vt-morph-part">
    <span className="inline-block">{plugin.title}</span>
  </ViewTransition>
)

export default function ViewTransitionShared() {
  const groupId = React.useId()
  const [selectedId, setSelectedId] = React.useState<null | Plugin['id']>(null)
  const selected = PLUGINS.find((plugin) => plugin.id === selectedId)
  const nameOf = (plugin: Plugin) => `${groupId}-${plugin.id}`

  const select = (id: null | Plugin['id']) => {
    startTransition(() => {
      setSelectedId(id)
    })
  }

  if (selected) {
    return (
      <ViewTransition enter="vt-fade-in" exit="vt-fade-out" key="detail">
        <div className="not-prose flex w-full flex-col gap-4">
          <ViewTransition name={nameOf(selected)} share="vt-morph">
            <div className="bg-card text-card-foreground flex flex-col gap-4 rounded-xl border p-6 shadow-xs">
              <Mark name={nameOf(selected)} plugin={selected} />
              <div className="flex flex-col gap-1">
                <h3 className="text-lg font-semibold text-balance">
                  <Title name={nameOf(selected)} plugin={selected} />
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {selected.description}
                </p>
              </div>
            </div>
          </ViewTransition>
          <Button
            className="self-start"
            onClick={() => {
              select(null)
            }}
            variant="ghost"
          >
            <ArrowLeftIcon aria-hidden />
            All plugins
          </Button>
        </div>
      </ViewTransition>
    )
  }

  return (
    <ViewTransition enter="vt-fade-in" exit="vt-fade-out" key="list">
      <ul className="not-prose flex w-full flex-col gap-2">
        {PLUGINS.map((plugin) => (
          <li key={plugin.id}>
            <ViewTransition name={nameOf(plugin)} share="vt-morph">
              <button
                className="bg-card text-card-foreground hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-3 rounded-xl border p-3 text-start text-sm font-medium shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
                onClick={() => {
                  select(plugin.id)
                }}
                type="button"
              >
                <Mark name={nameOf(plugin)} plugin={plugin} />
                <Title name={nameOf(plugin)} plugin={plugin} />
              </button>
            </ViewTransition>
          </li>
        ))}
      </ul>
    </ViewTransition>
  )
}
