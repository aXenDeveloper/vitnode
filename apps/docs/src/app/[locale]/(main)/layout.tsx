// import type { ReactNode } from 'react';

// import { HomeLayout } from 'fumadocs-ui/layouts/home';

// import { baseOptions } from '@/app/layout.config';

// export default function Layout({ children }: { children: ReactNode }) {
//   return <HomeLayout {...baseOptions}>{children}</HomeLayout>;
// }

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
