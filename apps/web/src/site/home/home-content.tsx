import { RouteMessages } from '@vitnode/core/tanstack/i18n'

import { HOME_NAMESPACES } from '@/site/home/namespaces'
import { AlternativesSection } from '@/site/home/sections/alternatives'
import { BentoSection } from '@/site/home/sections/bento'
import { BuildSection } from '@/site/home/sections/build'
import { CtaSection } from '@/site/home/sections/cta'
import { FaqSection } from '@/site/home/sections/faq'
import { HeroSection } from '@/site/home/sections/hero'
import { IntegrationsSection } from '@/site/home/sections/integrations'
import { ProblemsSection } from '@/site/home/sections/problems'
import { MarketingPage } from '@/site/marketing/marketing-page'
import { CanaryNotice } from '@/site/marketing/shared'

export const HomeRouteContent = () => (
  <RouteMessages namespaces={HOME_NAMESPACES}>
    <MarketingPage>
      <HeroSection />
      <div className="container mx-auto px-4 pt-12 sm:px-6">
        <CanaryNotice />
      </div>
      <BuildSection />
      <ProblemsSection />
      <BentoSection />
      <AlternativesSection />
      <IntegrationsSection />
      <FaqSection />
      <CtaSection />
    </MarketingPage>
  </RouteMessages>
)
