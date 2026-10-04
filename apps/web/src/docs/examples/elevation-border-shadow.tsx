import { CheckIcon, XIcon } from 'lucide-react'

const Verdict = ({ good }: { good: boolean }) => (
  <span
    className={`flex items-center gap-1 text-xs font-medium ${good ? 'text-success' : 'text-destructive'}`}
  >
    {good ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />}
    {good ? 'Do' : "Don't"}
  </span>
)

const Example = ({
  caption,
  children,
  good,
}: {
  caption: string
  children: React.ReactNode
  good: boolean
}) => (
  <figure className="bg-card m-0! flex flex-col gap-3 rounded-lg border p-3">
    <Verdict good={good} />
    <div
      aria-hidden
      className="bg-background flex min-h-28 items-center justify-center rounded-md p-4"
    >
      {children}
    </div>
    <figcaption className="m-0! text-muted-foreground text-xs leading-relaxed">
      {caption}
    </figcaption>
  </figure>
)

const SettingsRows = ({ className }: { className: string }) => (
  <div className={`bg-card flex w-full flex-col rounded-lg ${className}`}>
    <span className="border-b px-3 py-2 text-sm">Email alerts</span>
    <span className="px-3 py-2 text-sm">Weekly digest</span>
  </div>
)

const Menu = ({ className }: { className: string }) => (
  <div className={`bg-popover flex w-36 flex-col rounded-lg p-1 ${className}`}>
    <span className="bg-accent text-accent-foreground rounded-sm px-2 py-1.5 text-sm">
      Rename
    </span>
    <span className="rounded-sm px-2 py-1.5 text-sm">Archive</span>
  </div>
)

export default function ElevationBorderShadow() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <Example caption="Inline content sits flat with a hairline border." good>
        <SettingsRows className="border" />
      </Example>
      <Example caption="A big shadow on content that never moves." good={false}>
        <SettingsRows className="shadow-xl" />
      </Example>
      <Example caption="Floating layers get a shadow plus a faint ring." good>
        <Menu className="ring-foreground/10 shadow-lg ring-1" />
      </Example>
      <Example caption="A border-only menu melts into the page." good={false}>
        <Menu className="border" />
      </Example>
    </div>
  )
}
