import { Bubble, BubbleContent } from '@vitnode/core/components/ui/bubble'

const VARIANTS = [
  { text: 'Sent by you, loud and proud.', variant: 'default' },
  { text: 'The standard neutral reply.', variant: 'secondary' },
  { text: 'A quieter aside.', variant: 'muted' },
  { text: 'Soft, from your primary color.', variant: 'tinted' },
  { text: 'Great for suggestions.', variant: 'outline' },
  {
    text: 'Unframed and full width, like an assistant answer.',
    variant: 'ghost',
  },
  { text: 'Upload failed. Try again.', variant: 'destructive' },
] as const

export default function BubbleVariants() {
  return (
    <ul className="not-prose flex w-full flex-col gap-3">
      {VARIANTS.map(({ text, variant }) => (
        <li className="flex flex-col gap-1" key={variant}>
          <Bubble variant={variant}>
            <BubbleContent>{text}</BubbleContent>
          </Bubble>
          <code className="text-muted-foreground font-mono text-xs">
            {variant}
          </code>
        </li>
      ))}
    </ul>
  )
}
