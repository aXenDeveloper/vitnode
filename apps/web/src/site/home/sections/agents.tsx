import type { LucideIcon } from 'lucide-react'

import { cn } from 'cn'
import {
  BookOpen,
  Boxes,
  Braces,
  FileJson,
  FileText,
  ListChecks,
} from 'lucide-react'

import { AgentMap } from '@/site/home/illustrations/agent-map'
import {
  ActionLink,
  MarketingSection,
  SectionHeading,
  SectionRow,
  SURFACE,
  TextLink,
} from '@/site/marketing/shared'

const MAP_LEGEND: { Icon: LucideIcon; label: string }[] = [
  { Icon: FileText, label: 'AGENTS.md conventions' },
  { Icon: BookOpen, label: 'llms-full.txt of every doc' },
  { Icon: Braces, label: 'End-to-end typed fetcher' },
  { Icon: FileJson, label: 'OpenAPI from your routes' },
  { Icon: Boxes, label: 'Hard plugin boundaries' },
  { Icon: ListChecks, label: 'Lint rules that teach' },
]

export const AgentsSection = () => (
  <MarketingSection id="agents" labelledBy="agents-title">
    <SectionRow
      action={
        <ActionLink target="_blank" to="/llms-full.txt">
          Docs for your agent
        </ActionLink>
      }
    >
      <SectionHeading
        eyebrow="Built for humans. And their AI agents."
        id="agents-title"
        title="Give your coding agent a map."
      >
        Readable docs, one conventions file, the entire documentation as a
        single text file, typed APIs and strict plugin boundaries. Your agent
        stops guessing where things go. You review real progress instead of
        creative archaeology.
      </SectionHeading>
    </SectionRow>

    <div className="grid items-center gap-6 lg:grid-cols-5">
      <div className={cn(SURFACE.tint, 'p-4 sm:p-6 lg:col-span-3')}>
        <AgentMap />
      </div>

      <div
        className={cn(
          SURFACE.soft,
          'flex flex-col gap-6 p-7 sm:p-8 lg:col-span-2',
        )}
      >
        <ul className="flex flex-col gap-3">
          {MAP_LEGEND.map(({ Icon, label }) => (
            <li className="flex items-center gap-3 font-medium" key={label}>
              <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                <Icon aria-hidden className="size-4" />
              </span>
              {label}
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground font-book leading-relaxed text-pretty">
          Building AI into the product itself? The same framework gives you
          summaries, streaming answers and embeddings through the Vercel AI SDK
          with whichever provider you trust.
        </p>

        <TextLink params={{ _splat: 'dev/ai' }} to="/docs/$">
          Build AI features
        </TextLink>
      </div>
    </div>
  </MarketingSection>
)
