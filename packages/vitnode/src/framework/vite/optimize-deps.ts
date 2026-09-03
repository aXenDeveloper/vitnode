import type { Plugin } from "vite";

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const PACKAGE_NAME = "@vitnode/core";

export const VITNODE_CLIENT_DEPENDENCIES = [
  "@base-ui/react",
  "@base-ui/react/accordion",
  "@base-ui/react/alert-dialog",
  "@base-ui/react/avatar",
  "@base-ui/react/button",
  "@base-ui/react/checkbox",
  "@base-ui/react/collapsible",
  "@base-ui/react/context-menu",
  "@base-ui/react/dialog",
  "@base-ui/react/direction-provider",
  "@base-ui/react/input",
  "@base-ui/react/menu",
  "@base-ui/react/menubar",
  "@base-ui/react/merge-props",
  "@base-ui/react/navigation-menu",
  "@base-ui/react/popover",
  "@base-ui/react/preview-card",
  "@base-ui/react/progress",
  "@base-ui/react/radio",
  "@base-ui/react/radio-group",
  "@base-ui/react/scroll-area",
  "@base-ui/react/select",
  "@base-ui/react/separator",
  "@base-ui/react/slider",
  "@base-ui/react/switch",
  "@base-ui/react/tabs",
  "@base-ui/react/toggle",
  "@base-ui/react/toggle-group",
  "@base-ui/react/tooltip",
  "@base-ui/react/use-render",
  "@dnd-kit/core",
  "@dnd-kit/modifiers",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
  "@hookform/resolvers/zod",
  "@tanstack/react-query",
  "@tiptap/extension-text-align",
  "@tiptap/react",
  "@tiptap/starter-kit",
  "class-variance-authority",
  "clsx",
  "cmdk",
  "embla-carousel-react",
  "input-otp",
  "lucide-react",
  "motion/react",
  "react-colorful",
  "react-hook-form",
  "react-resizable-panels",
  "react-scan",
  "recharts",
  "sonner",
  "tailwind-merge",
  "use-debounce",
  "use-intl",
  "vaul",
  "zod",
] as const;

const packageNameOf = (specifier: string): string => {
  const segments = specifier.split("/");

  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
};

const isReachableFrom = (root: string, packageName: string): boolean => {
  for (let directory = root; ; directory = dirname(directory)) {
    if (existsSync(join(directory, "node_modules", packageName))) return true;
    if (dirname(directory) === directory) return false;
  }
};

export const vitNodeClientDepsInclude = (root: string): string[] =>
  VITNODE_CLIENT_DEPENDENCIES.map(specifier =>
    isReachableFrom(root, packageNameOf(specifier))
      ? specifier
      : `${PACKAGE_NAME} > ${specifier}`,
  );

export const vitNodeOptimizeDeps = (): Plugin => ({
  apply: "serve",
  config: userConfig => ({
    optimizeDeps: {
      include: vitNodeClientDepsInclude(userConfig.root ?? process.cwd()),
    },
  }),
  name: "vitnode:optimize-deps",
});
