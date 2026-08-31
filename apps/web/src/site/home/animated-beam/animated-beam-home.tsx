import { LogoVitNode } from '@vitnode/core/components/logo-vitnode'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@vitnode/core/components/ui/tooltip'
import { cn } from '@vitnode/core/lib/utils'
import {
  AtSign,
  Database,
  Languages,
  Paintbrush,
  Plug,
  ShieldCheck,
  Sparkle,
  Users,
} from 'lucide-react'
import { useRef } from 'react'

import type { SiteLinkComponent } from '#/site/home/site-link'

import { AnimatedBeam } from '#/site/home/animated-beam/animated-beam'

const CIRCLE_CLASS =
  'bg-card hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 z-10 flex size-12 items-center justify-center rounded-md border p-3 transition-all focus-visible:ring-[3px]'

const Circle = ({
  LinkComponent,
  children,
  className,
  href,
  ref,
  tooltip,
}: {
  children: React.ReactNode
  className?: string
  href: string
  LinkComponent: SiteLinkComponent
  ref: React.RefObject<HTMLAnchorElement | null>
  tooltip?: string
}) => {
  const link = (
    <LinkComponent
      className={cn(CIRCLE_CLASS, className)}
      href={href}
      ref={ref}
    >
      {children}
    </LinkComponent>
  )

  if (!tooltip) return link

  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

/**
 * What VitNode gives you, drawn as beams converging on the mark.
 *
 * Migrated from the Next.js homepage with the same nine circles, the same eight
 * beams and the same directions. Three things changed, all of them framework
 * coupling rather than design:
 *
 * - **The links.** They were `@vitnode/core/lib/navigation`'s `Link`, which is
 *   next-intl's navigation and does not exist outside Next.js. They are the
 *   injected {@link SiteLinkComponent} now, which matters for more than
 *   compiling: two of these circles point into `/docs`, and that is still the
 *   Next.js application's.
 * - **The mark.** `LogoVitNode` from `@vitnode/core`, rather than the byte-identical
 *   copy that sat in `apps/docs/src/components`. There is one VitNode logo.
 * - **The tooltip provider.** It was mounted per circle; `VitNodeRootProviders`
 *   mounts one above every route in this application, and a second provider
 *   inside it is eight extra React trees for no behaviour.
 *
 * `containerRef` is what every beam measures against, which is why the beams are
 * siblings of the grid rather than children of it: they are absolutely
 * positioned over the whole container and sized from its rect.
 */
export const AnimatedBeamHome = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const usersRef = useRef<HTMLAnchorElement>(null)
  const languagesRef = useRef<HTMLAnchorElement>(null)
  const authorizationRef = useRef<HTMLAnchorElement>(null)
  const vitnodeRef = useRef<HTMLAnchorElement>(null)
  const pluginsRef = useRef<HTMLAnchorElement>(null)
  const themesRef = useRef<HTMLAnchorElement>(null)
  const databaseRef = useRef<HTMLAnchorElement>(null)
  const emailsRef = useRef<HTMLAnchorElement>(null)
  const aiRef = useRef<HTMLAnchorElement>(null)

  return (
    <div
      className="relative flex w-full items-center justify-center overflow-hidden p-4 sm:max-w-md"
      ref={containerRef}
    >
      <div className="flex size-full max-w-lg flex-col items-stretch justify-between gap-10">
        <div className="flex flex-row items-center justify-between">
          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={usersRef}
            tooltip="Users"
          >
            <Users />
          </Circle>
          <Circle
            href="/docs/dev/email/overview"
            LinkComponent={LinkComponent}
            ref={emailsRef}
            tooltip="Emails"
          >
            <AtSign />
          </Circle>
          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={pluginsRef}
            tooltip="Plugins"
          >
            <Plug />
          </Circle>
        </div>

        <div className="flex flex-row items-center justify-between">
          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={languagesRef}
            tooltip="Languages"
          >
            <Languages />
          </Circle>

          <Circle
            className="size-16"
            href="/docs/dev"
            LinkComponent={LinkComponent}
            ref={vitnodeRef}
          >
            <LogoVitNode small />
          </Circle>

          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={themesRef}
            tooltip="Themes"
          >
            <Paintbrush />
          </Circle>
        </div>

        <div className="flex flex-row items-center justify-between">
          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={authorizationRef}
            tooltip="Authorization"
          >
            <ShieldCheck />
          </Circle>
          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={aiRef}
            tooltip="AI"
          >
            <Sparkle />
          </Circle>
          <Circle
            href="/"
            LinkComponent={LinkComponent}
            ref={databaseRef}
            tooltip="Database"
          >
            <Database />
          </Circle>
        </div>
      </div>

      <AnimatedBeam
        containerRef={containerRef}
        fromRef={usersRef}
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={languagesRef}
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={authorizationRef}
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={pluginsRef}
        reverse
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={themesRef}
        reverse
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={databaseRef}
        reverse
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={emailsRef}
        toRef={vitnodeRef}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={aiRef}
        toRef={vitnodeRef}
      />
    </div>
  )
}
