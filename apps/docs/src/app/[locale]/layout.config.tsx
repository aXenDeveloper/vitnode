import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { LogoVitNode } from "@vitnode/core/components/logo-vitnode";

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
// TODO: Remove this
export const baseOptions: BaseLayoutProps = {
  githubUrl: "https://github.com/VitNode/vitnode",
  nav: {
    title: (
      <>
        <LogoVitNode className="w-30" />
      </>
    ),
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
  ],
};
