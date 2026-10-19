import { CopyButton } from '@vitnode/core/components/ui/copy-button'
import { ExternalLink } from 'lucide-react'

import { MarketingPage } from '@/site/marketing/marketing-page'
import {
  CanaryNotice,
  Eyebrow,
  HeroShell,
  MarketingActions,
  MarketingSection,
  SectionHeading,
  TextLink,
} from '@/site/marketing/shared'

import type { Extension } from './data'

import {
  EXTENSION_KINDS,
  EXTENSIONS,
  installCommand,
  INTEGRATION_GROUPS,
} from './data'

const Hero = ({
  description,
  eyebrow,
  id,
  title,
}: {
  description: string
  eyebrow: string
  id: string
  title: string
}) => (
  <section aria-labelledby={id} className="relative overflow-hidden">
    <HeroShell>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1
        className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        id={id}
      >
        {title}
      </h1>
      <p className="text-muted-foreground max-w-2xl text-base leading-relaxed text-pretty sm:text-lg">
        {description}
      </p>
      <MarketingActions className="justify-center" />
    </HeroShell>
  </section>
)

const PackageChip = ({ name }: { name: string }) => (
  <code className="bg-muted w-fit rounded-md px-2 py-1 font-mono text-xs">
    {name}
  </code>
)

export const IntegrationsPage = () => (
  <MarketingPage>
    <Hero
      description="Search, storage, email, sign-in, AI, background jobs and hosting. Each one is a line in your config, and every one below ships today."
      eyebrow="Integrations"
      id="integrations-title"
      title="Plug VitNode into the services you already use."
    />

    {INTEGRATION_GROUPS.map((group) => {
      const id = `integrations-${group.title.toLowerCase().replaceAll(' ', '-')}`

      return (
        <MarketingSection key={group.title} labelledBy={id}>
          <SectionHeading eyebrow="Integrations" id={id} title={group.title}>
            {group.description}
          </SectionHeading>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <li key={item.name}>
                <article className="bg-card flex h-full flex-col gap-3 rounded-2xl border p-6">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {item.name}
                  </h3>
                  {item.packageName ? (
                    <PackageChip name={item.packageName} />
                  ) : (
                    <span className="text-muted-foreground font-mono text-xs">
                      Built into @vitnode/core
                    </span>
                  )}
                  <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
                    {item.description}
                  </p>
                  <TextLink
                    className="mt-auto"
                    params={{ _splat: item.docs }}
                    to="/docs/$"
                  >
                    Read the docs
                  </TextLink>
                </article>
              </li>
            ))}
          </ul>
        </MarketingSection>
      )
    })}

    <MarketingSection labelledBy="integrations-more-title">
      <SectionHeading
        eyebrow="Need something else?"
        id="integrations-more-title"
        title="Write your own adapter."
      >
        Storage and email adapters are small interfaces. The docs show how to
        write one for a provider that is not on this page.
      </SectionHeading>
      <div className="flex flex-wrap gap-6">
        <TextLink
          params={{ _splat: 'dev/storage/custom-adapter' }}
          to="/docs/$"
        >
          Write a storage adapter
        </TextLink>
        <TextLink params={{ _splat: 'dev/email/custom-adapter' }} to="/docs/$">
          Write an email adapter
        </TextLink>
        <TextLink to="/extensions">Browse every official package</TextLink>
      </div>
      <CanaryNotice />
    </MarketingSection>
  </MarketingPage>
)

const ExtensionRow = ({ extension }: { extension: Extension }) => {
  const command = installCommand(extension)

  return (
    <li className="bg-card flex flex-col gap-4 rounded-2xl border p-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      <div className="flex min-w-0 flex-col gap-2">
        <h3 className="font-mono text-base font-semibold break-all">
          {extension.name}
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {extension.description}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {extension.docs ? (
            <TextLink
              className="text-sm"
              params={{ _splat: extension.docs }}
              to="/docs/$"
            >
              Docs
            </TextLink>
          ) : null}
          <a
            className="text-primary inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            href={`https://www.npmjs.com/package/${extension.name}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            npm
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className="bg-muted/60 flex min-w-0 shrink-0 items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-3 lg:w-96">
        <code className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">
          {command}
        </code>
        <CopyButton
          aria-label={`Copy install command for ${extension.name}`}
          content={command}
          size="sm"
          variant="outline"
        >
          Copy
        </CopyButton>
      </div>
    </li>
  )
}

export const ExtensionsPage = () => (
  <MarketingPage>
    <Hero
      description="Every plugin, adapter and tool the VitNode team publishes, with the command to install it. All of them are free and MIT-licensed."
      eyebrow="Extension directory"
      id="extensions-title"
      title="Official VitNode plugins and adapters."
    />

    {EXTENSION_KINDS.map(({ description, kind, title }) => (
      <MarketingSection key={kind} labelledBy={`extensions-${kind}`}>
        <SectionHeading
          eyebrow="Directory"
          id={`extensions-${kind}`}
          title={title}
        >
          {description}
        </SectionHeading>
        <ul className="flex flex-col gap-3">
          {EXTENSIONS.filter((item) => item.kind === kind).map((extension) => (
            <ExtensionRow extension={extension} key={extension.name} />
          ))}
        </ul>
      </MarketingSection>
    ))}

    <MarketingSection labelledBy="extensions-own-title">
      <SectionHeading
        eyebrow="Build your own"
        id="extensions-own-title"
        title="Your plugin can live here too."
      >
        Plugins are npm packages. Scaffold one with create-vitnode-app, publish
        it, and anyone can add it to their site and config.
      </SectionHeading>
      <div className="flex flex-wrap gap-6">
        <TextLink params={{ _splat: 'guides/first-plugin' }} to="/docs/$">
          Build your first plugin
        </TextLink>
        <TextLink to="/plugins">How plugins work</TextLink>
      </div>
      <CanaryNotice />
    </MarketingSection>
  </MarketingPage>
)
