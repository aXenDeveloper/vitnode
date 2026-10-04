import {
  Bubble,
  BubbleContent,
  BubbleReactions,
} from '@vitnode/core/components/ui/bubble'

const PLACEMENTS = [
  { align: 'end', label: 'Tests passed on the first try.', side: 'bottom' },
  { align: 'start', label: 'Shipping it on Friday.', side: 'bottom' },
  { align: 'end', label: 'Who renamed the main branch?', side: 'top' },
] as const

export default function BubbleReactionsDemo() {
  return (
    <ul className="not-prose flex w-full flex-col gap-8">
      {PLACEMENTS.map(({ align, label, side }) => (
        <li className="flex flex-col gap-5" key={label}>
          <Bubble variant="muted">
            <BubbleContent>{label}</BubbleContent>
            <BubbleReactions
              align={align}
              aria-label="Reactions: rocket, eyes"
              role="img"
              side={side}
            >
              <span>🚀</span>
              <span>👀</span>
            </BubbleReactions>
          </Bubble>
          <code className="text-muted-foreground font-mono text-xs">
            side=&quot;{side}&quot; align=&quot;{align}&quot;
          </code>
        </li>
      ))}
    </ul>
  )
}
