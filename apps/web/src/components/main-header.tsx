import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { ThemeSwitcher } from '@vitnode/core/components/switchers/themes/theme-switcher'
import {
  LanguageSwitcher,
  RouterLink,
  UserHeader,
} from '@vitnode/core/tanstack/layout'

export const MainHeader = () => (
  <header className="marketing marketing-header">
    <a className="marketing-skip-link" href="#main-content">
      Skip to content
    </a>
    <div className="marketing-shell marketing-header-top">
      <RouterLink aria-label="VitNode home" className="marketing-logo" href="/">
        <LogoVitNodeBrand />
      </RouterLink>
      <nav aria-label="Main navigation" className="marketing-nav">
        <RouterLink href="/">Overview</RouterLink>
        <RouterLink href="/pricing">Pricing</RouterLink>
        <RouterLink href="/docs/dev">Documentation</RouterLink>
        <RouterLink href="/discover">Discover</RouterLink>
        <RouterLink href="/search">Search</RouterLink>
      </nav>
      <div className="marketing-header-controls">
        <LanguageSwitcher />
        <ThemeSwitcher />
        <UserHeader />
      </div>
    </div>
  </header>
)
