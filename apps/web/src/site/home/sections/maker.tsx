import { Coffee, Heart } from 'lucide-react'

import {
  AUTHOR_AVATAR_URL,
  AUTHOR_NAME,
  AUTHOR_URL,
  REPOSITORY_URL,
} from '#/site/marketing/links'
import { Eyebrow, GitHubIcon, MarketingSection } from '#/site/marketing/shared'

const FACTS = [
  { label: 'human building in the open', value: '1' },
  { label: 'investors, licence fees, dark patterns', value: '0' },
  { label: 'coffee consumed per release', value: '∞' },
]

export const MakerSection = () => (
  <MarketingSection id="maker" labelledBy="maker-title">
    <div className="bg-card grid gap-10 rounded-3xl border p-6 sm:p-10 lg:grid-cols-3">
      <div className="flex flex-col items-start gap-4">
        <img
          alt={`${AUTHOR_NAME}, creator of VitNode`}
          className="size-32 rounded-3xl border object-cover shadow-md sm:size-40"
          decoding="async"
          height={160}
          loading="lazy"
          src={AUTHOR_AVATAR_URL}
          width={160}
        />
        <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
          <Heart aria-hidden className="size-3.5" /> Made by a human
        </span>
      </div>

      <div className="flex flex-col gap-5 lg:col-span-2">
        <Eyebrow>A note from the maker</Eyebrow>
        <h2
          className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
          id="maker-title"
        >
          Hey, I’m Maciej. I got tired of rebuilding the same admin panel.
        </h2>
        <div className="text-muted-foreground flex flex-col gap-3 text-base leading-relaxed text-pretty">
          <p>
            I have spent years building community platforms, and every single
            one started the same way: a login form, a users table, a roles
            screen, a permissions system, translations, and three weeks of glue
            before anyone saw a feature. At some point you either accept it or
            you fix it.
          </p>
          <p>
            VitNode is me fixing it. Open source, opinionated in the useful
            places, and built so the interesting work happens in plugins. It is
            early and it is honest about that. If you build communities for a
            living, or you just want yours to be truly yours, I would love your
            bug reports, your feedback and your weird plugin ideas.
          </p>
        </div>

        <dl className="grid gap-4 sm:grid-cols-3">
          {FACTS.map(({ label, value }) => (
            <div className="flex flex-col gap-1 border-l-2 pl-4" key={label}>
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="text-primary text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <a
            className="text-primary inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            href={AUTHOR_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <GitHubIcon /> @aXenDeveloper
          </a>
          <a
            className="text-primary inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            href={REPOSITORY_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Coffee aria-hidden className="size-4" /> Star the repo, it counts
            as coffee
          </a>
        </div>
      </div>
    </div>
  </MarketingSection>
)
