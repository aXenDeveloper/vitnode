import type { LucideIcon } from 'lucide-react'

import {
  BookOpen,
  Boxes,
  Braces,
  FileJson,
  FileText,
  ListChecks,
} from 'lucide-react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { AgentMap } from '#/site/home/illustrations/agent-map'
import {
  MarketingSection,
  SectionHeading,
  TextLink,
} from '#/site/marketing/shared'

const MAP_LEGEND: { Icon: LucideIcon; label: string }[] = [
  { Icon: FileText, label: 'AGENTS.md conventions' },
  { Icon: BookOpen, label: 'llms-full.txt of every doc' },
  { Icon: Braces, label: 'End-to-end typed fetcher' },
  { Icon: FileJson, label: 'OpenAPI from your routes' },
  { Icon: Boxes, label: 'Hard plugin boundaries' },
  { Icon: ListChecks, label: 'Lint rules that teach' },
]

export const AgentsSection = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="bg-muted/40 border-y">
    <MarketingSection id="agents" labelledBy="agents-title">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <AgentMap />

        <div className="flex flex-col gap-8">
          <SectionHeading
            eyebrow="Built for humans. And their AI agents."
            id="agents-title"
            title="Give your coding agent a map."
          >
            Readable docs, one conventions file, the entire documentation as a
            single text file, typed APIs and strict plugin boundaries. Your
            agent stops guessing where things go. You review real progress
            instead of creative archaeology.
          </SectionHeading>

          <ul className="grid gap-3 sm:grid-cols-2">
            {MAP_LEGEND.map(({ Icon, label }) => (
              <li
                className="bg-card flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium"
                key={label}
              >
                <Icon aria-hidden className="text-primary size-4 shrink-0" />
                {label}
              </li>
            ))}
          </ul>

          <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
            Building AI into the product itself? The same framework gives you
            summaries, streaming answers and embeddings through the Vercel AI
            SDK with whichever provider you trust.
          </p>

          <div className="flex flex-wrap gap-6">
            <TextLink href="/llms-full.txt" LinkComponent={LinkComponent}>
              Docs for your agent
            </TextLink>
            <TextLink href="/docs/dev/ai" LinkComponent={LinkComponent}>
              Build AI features
            </TextLink>
          </div>
        </div>
      </div>
    </MarketingSection>
  </div>
)
