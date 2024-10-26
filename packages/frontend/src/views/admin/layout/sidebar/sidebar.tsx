import { LogoVitNode } from '@/components/logo-vitnode';
import { LanguageSwitcher } from '@/components/switchers/language-switcher';
import { ThemeSwitcher } from '@/components/switchers/theme-switcher';
import { Sidebar, SidebarHeader } from '@/components/ui/sidebar';
import { CONFIG } from '@/helpers/config-with-env';
import { Link } from '@/navigation';

import { SearchSidebarAdmin } from './search/search';

export const SidebarAdmin = () => {
  return (
    <Sidebar variant="inset">
      {/* {CONFIG.node_development && (
        <div
          className="absolute left-0 top-0 z-50 h-1 w-full"
          style={{
            backgroundImage:
              'repeating-linear-gradient(-55deg,#000, #000 20px, #ffb103 20px, #feb100 40px)',
          }}
        />
      )} */}
      <SidebarHeader className="flex-row items-center justify-between">
        <Link href="/admin/core/dashboard">
          <LogoVitNode className="h-8" small />
        </Link>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeSwitcher />

          <div>test</div>
        </div>
      </SidebarHeader>
      <SearchSidebarAdmin />
      test
    </Sidebar>
  );
};
