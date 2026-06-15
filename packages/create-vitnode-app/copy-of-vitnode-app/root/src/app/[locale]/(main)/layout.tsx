import { LogoVitNode } from "@vitnode/core/components/logo-vitnode";
import { ThemeLayout } from "@vitnode/core/views/layouts/theme/layout";

import { vitNodeConfig } from "../../../vitnode.config";

export default function Layout({
  children,
  breadcrumb,
}: {
  breadcrumb: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <ThemeLayout
      breadcrumb={breadcrumb}
      logo={<LogoVitNode className="w-34" />}
      vitNodeConfig={vitNodeConfig}
    >
      {children}
    </ThemeLayout>
  );
}
