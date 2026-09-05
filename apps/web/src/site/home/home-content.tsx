import type { SiteLinkComponent } from '#/site/home/site-link'

import { AgentsSection } from '#/site/home/sections/agents'
import { CommunitySection } from '#/site/home/sections/community'
import { ComparisonSection } from '#/site/home/sections/comparison'
import { DevelopersSection } from '#/site/home/sections/developers'
import { FeaturesBentoSection } from '#/site/home/sections/features-bento'
import { FinalCtaSection } from '#/site/home/sections/final-cta'
import { HeroSection } from '#/site/home/sections/hero'
import { HostingSection } from '#/site/home/sections/hosting'
import { MakerSection } from '#/site/home/sections/maker'
import { OutcomesSection } from '#/site/home/sections/outcomes'
import { PluginsSection } from '#/site/home/sections/plugins'
import { PoweringBySection } from '#/site/home/sections/powering-by'
import { SecuritySection } from '#/site/home/sections/security'
import { ShowcaseSection } from '#/site/home/sections/showcase'
import { CanaryNotice } from '#/site/marketing/shared'

export const HomeRouteContent = ({
  LinkComponent,
}: {
  LinkComponent: SiteLinkComponent
}) => (
  <div className="flex flex-col">
    <HeroSection LinkComponent={LinkComponent} />
    <PoweringBySection />
    <div className="container mx-auto px-4 pt-12 sm:px-6">
      <CanaryNotice LinkComponent={LinkComponent} />
    </div>
    <OutcomesSection />
    <FeaturesBentoSection LinkComponent={LinkComponent} />
    <PluginsSection LinkComponent={LinkComponent} />
    <ShowcaseSection LinkComponent={LinkComponent} />
    <CommunitySection LinkComponent={LinkComponent} />
    <AgentsSection LinkComponent={LinkComponent} />
    <SecuritySection LinkComponent={LinkComponent} />
    <HostingSection LinkComponent={LinkComponent} />
    <ComparisonSection />
    <DevelopersSection LinkComponent={LinkComponent} />
    <MakerSection />
    <FinalCtaSection LinkComponent={LinkComponent} />
  </div>
)
