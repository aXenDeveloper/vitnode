import { RouteMessages } from '@vitnode/core/tanstack/i18n'

import { HOME_NAMESPACES } from '@/site/home/namespaces'
import { BentoSection } from '@/site/home/sections/bento'
import { FaqSection } from '@/site/home/sections/faq'
import { HeroSection } from '@/site/home/sections/hero'
import { IntegrationsSection } from '@/site/home/sections/integrations'
import { MarketingPage } from '@/site/marketing/marketing-page'
import { CanaryNotice } from '@/site/marketing/shared'

export const HomeRouteContent = () => (
  <RouteMessages namespaces={HOME_NAMESPACES}>
    <MarketingPage>
      <HeroSection />
      <div className="container mx-auto px-4 pt-12 sm:px-6">
        <CanaryNotice />
      </div>
      <BentoSection />
      <IntegrationsSection />
      <FaqSection />
    </MarketingPage>
  </RouteMessages>
)
