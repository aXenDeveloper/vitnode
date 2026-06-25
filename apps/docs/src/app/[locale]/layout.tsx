import type { RootLayoutProps } from "@vitnode/core/views/layouts/root-layout";
import type { Metadata } from "next";

import {
  generateMetadataRootLayout,
  RootLayout,
} from "@vitnode/core/views/layouts/root-layout";
import { RootProvider } from "fumadocs-ui/provider/next";

import { vitNodeConfig } from "@/vitnode.config";

import SearchDialogFumadocs from "../../components/fumadocs/search-dialog";

export const generateMetadata = (): Metadata =>
  generateMetadataRootLayout(vitNodeConfig);

export default function LocaleLayout(props: RootLayoutProps) {
  return (
    <RootProvider
      search={{
        SearchDialog: SearchDialogFumadocs,
      }}
      theme={{ enabled: false }}
    >
      <RootLayout config={vitNodeConfig} {...props} />
    </RootProvider>
  );
}
