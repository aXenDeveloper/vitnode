import { CheckIcon, CircleCheckIcon, CircleXIcon, XIcon } from 'lucide-react'

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
  <figure className="bg-card flex flex-col gap-3 rounded-lg border p-3">
    <Verdict good={good} />
    <div className="flex min-h-16 items-center justify-center">{children}</div>
    <figcaption className="text-muted-foreground text-xs leading-relaxed">
      {caption}
    </figcaption>
  </figure>
)

export default function ColorsDoDont() {
  return (
    <div className="not-prose grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <Example caption="Pair a surface with its own text color." good>
        <span className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium">
          Publish
        </span>
      </Example>
      <Example
        caption="Override the background but keep the old text color."
        good={false}
      >
        <span className="bg-primary text-foreground rounded-md px-3 py-2 text-sm font-medium">
          Publish
        </span>
      </Example>
      <Example caption="Back the color with an icon and a word." good>
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-success flex items-center gap-1.5">
            <CircleCheckIcon className="size-4" /> Build passed
          </span>
          <span className="text-destructive flex items-center gap-1.5">
            <CircleXIcon className="size-4" /> Build failed
          </span>
        </div>
      </Example>
      <Example caption="Let red versus green carry the meaning." good={false}>
        <div className="flex items-center gap-3">
          <span aria-hidden className="bg-success size-3 rounded-full" />
          <span aria-hidden className="bg-destructive size-3 rounded-full" />
        </div>
      </Example>
    </div>
  )
}
