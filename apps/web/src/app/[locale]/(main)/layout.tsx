import { LogoVitNode } from '@vitnode/core/components/logo-vitnode';
import { ThemeLayout } from '@vitnode/core/views/layouts/theme/layout';

import { vitNodeConfig } from '../../../vitnode.config';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeLayout
      logo={<LogoVitNode className="w-34" />}
      vitNodeConfig={vitNodeConfig}
    >
      {children}
    </ThemeLayout>
  );
}
