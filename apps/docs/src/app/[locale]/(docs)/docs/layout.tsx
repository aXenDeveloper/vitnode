import type { ReactNode } from "react";

import { ThemeSwitcher } from "@vitnode/core/components/switchers/themes/theme-switcher";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";

import { baseOptions } from "@/app/[locale]/layout.config";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      githubUrl={baseOptions.githubUrl}
      nav={{ ...baseOptions.nav, mode: "top" }}
      sidebar={{
        tabs: {
          transform(option, node) {
            const meta = source.getNodeMeta(node);
            if (!(meta && node.icon)) return option;

            const color = `var(--${meta.path.split("/")[0]}-color, var(--color-fd-foreground))`;

            return {
              ...option,
              icon: (
                <div
                  className="size-full rounded-lg max-md:border max-md:bg-(--tab-color)/10 max-md:p-1.5 [&_svg]:size-full"
                  style={
                    {
                      color,
                      "--tab-color": color,
                    } as React.CSSProperties
                  }
                >
                  {node.icon}
                </div>
              ),
            };
          },
        },
      }}
      slots={{ themeSwitch: ThemeSwitcher }}
      tree={source.pageTree}
    >
      {children}
    </DocsLayout>
  );
}
