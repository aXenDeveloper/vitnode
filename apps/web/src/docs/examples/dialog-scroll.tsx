import { Button } from '@vitnode/core/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@vitnode/core/components/ui/dialog'

const rules = [
  {
    title: 'Be kind',
    body: 'Disagree with ideas, not people. Personal attacks get removed, no matter how clever they are.',
  },
  {
    title: 'Stay on topic',
    body: 'Post in the category that fits. Moderators may move threads that wander off.',
  },
  {
    title: 'No spam',
    body: 'Self-promotion is fine in the Showcase category. Everywhere else, share it only when it answers the question.',
  },
  {
    title: 'Search first',
    body: 'Someone may have asked already. Linking an old thread is faster than waiting for a new answer.',
  },
  {
    title: 'Use clear titles',
    body: '"Help!!!" tells nobody anything. "Login fails after password reset" gets answers.',
  },
  {
    title: 'Mark solutions',
    body: 'When a reply solves your problem, mark it. The next person with the same issue will thank you.',
  },
  {
    title: 'Respect privacy',
    body: 'Never share personal details about other members, even if they are public somewhere else.',
  },
  {
    title: 'Report, don’t reply',
    body: 'If something breaks the rules, report it. Replying to trolls only feeds them.',
  },
]

export default function DialogScrollDemo() {
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="outline">Read community rules</Button>}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Community rules</DialogTitle>
          <DialogDescription>
            Eight short rules that keep the forum a nice place to hang out.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-4">
          {rules.map(({ body, title }, index) => (
            <li className="flex gap-3" key={title}>
              <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <DialogClose render={<Button>I agree</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
