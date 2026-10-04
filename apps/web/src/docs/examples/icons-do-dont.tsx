import { Button, buttonVariants } from '@vitnode/core/components/ui/button'
import {
  BellIcon,
  CheckIcon,
  GitBranchIcon,
  MailIcon,
  SettingsIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react'

import { GitHubIcon } from '@/site/marketing/shared'

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
    <div className="flex min-h-16 items-center justify-center gap-2">
      {children}
    </div>
    <figcaption className="text-muted-foreground text-xs leading-relaxed">
      {caption}
    </figcaption>
  </figure>
)

export default function IconsDoDont() {
  return (
    <div className="not-prose grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <Example
        caption='Give icon-only buttons an aria-label, like "Delete post".'
        good
      >
        <Button aria-label="Delete post" size="icon" variant="outline">
          <Trash2Icon />
        </Button>
      </Example>
      <Example
        caption="Ship a bare icon and hope everyone reads trash cans."
        good={false}
      >
        <span
          aria-hidden
          className={buttonVariants({ size: 'icon', variant: 'outline' })}
        >
          <Trash2Icon />
        </span>
      </Example>
      <Example caption="Use the real brand mark as an SVG." good>
        <Button variant="outline">
          <GitHubIcon />
          GitHub
        </Button>
      </Example>
      <Example caption="Fake a logo with a lookalike lucide icon." good={false}>
        <Button variant="outline">
          <GitBranchIcon />
          GitHub
        </Button>
      </Example>
      <Example caption="Keep one size and stroke in a row." good>
        <MailIcon className="size-5" />
        <BellIcon className="size-5" />
        <SettingsIcon className="size-5" />
      </Example>
      <Example caption="Mix sizes and strokes side by side." good={false}>
        <MailIcon className="size-4" strokeWidth={1} />
        <BellIcon className="size-6" strokeWidth={2.5} />
        <SettingsIcon className="size-5" strokeWidth={1.5} />
      </Example>
    </div>
  )
}
