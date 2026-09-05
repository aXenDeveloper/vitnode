import { LogoVitNodeBrand } from '@vitnode/core/components/logo-vitnode'
import { MainHeader as MainHeaderContent } from '@vitnode/core/tanstack/layout'

export const MainHeader = () => (
  <MainHeaderContent logo={<LogoVitNodeBrand />} />
)
