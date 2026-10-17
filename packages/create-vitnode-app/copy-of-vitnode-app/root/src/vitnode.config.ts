import { buildConfig } from "@vitnode/core/vitnode.config";
import { CompassIcon, SearchIcon } from "lucide-react";

export const vitNodeConfig = buildConfig({
  debug: false,
  i18n: {
    defaultLocale: "en",
    locales: [{ code: "en", name: "English" }],
    timeZone: "UTC",
  },
  metadata: {
    shortTitle: "VitNode",
    title: "VitNode",
  },
  navigation: {
    header: [
      { href: "/discover", icon: CompassIcon, title: "app.menu.discover" },
      { href: "/search", icon: SearchIcon, title: "app.menu.search" },
    ],
  },
  plugins: [],
  theme: {
    defaultTheme: "system",
  },
});

export type Locale = (typeof vitNodeConfig.i18n.locales)[number]["code"];
