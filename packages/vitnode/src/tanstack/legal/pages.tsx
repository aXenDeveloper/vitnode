import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import type { PluginRoutePageProps } from "@/routing";

import { defineRoute } from "../plugin-routes";
import {
  type LegalChangesSearch,
  type LegalDocumentRouteData,
  type LegalVersionRouteData,
  loadLegalChangesRoute,
  loadLegalDocumentRoute,
  loadLegalVersionRoute,
  parseLegalVersionParam,
} from "./route";
import {
  LegalChangesRouteContent,
  LegalDocumentRouteContent,
  LegalVersionRouteContent,
} from "./screen";

/** The page module of `/terms` or `/privacy`. */
export const legalDocumentPage = (documentType: LegalDocumentType) => {
  const Page = ({
    loaderData,
  }: PluginRoutePageProps<LegalDocumentRouteData>) => (
    <LegalDocumentRouteContent documentType={loaderData.documentType} />
  );

  const route = defineRoute<LegalDocumentRouteData>({
    load: async ({ context, t }) =>
      await loadLegalDocumentRoute({ ...context, documentType, t }),
    head: ({ loaderData }) => ({
      description: loaderData?.description,
      robots: "index, follow",
      title: loaderData?.title,
    }),
  });

  return { Page, route };
};

/** The page module of `/terms/versions/:version` or its Privacy twin. */
export const legalVersionPage = (documentType: LegalDocumentType) => {
  const Page = ({
    loaderData,
  }: PluginRoutePageProps<LegalVersionRouteData>) => (
    <LegalVersionRouteContent
      documentType={loaderData.documentType}
      version={loaderData.version}
    />
  );

  const route = defineRoute<LegalVersionRouteData>({
    load: async ({ context, params, t }) =>
      await loadLegalVersionRoute({
        ...context,
        documentType,
        t,
        version: parseLegalVersionParam(params.version),
      }),
    head: ({ loaderData }) => ({
      description: loaderData?.description,
      robots: "index, follow",
      title: loaderData?.title,
    }),
  });

  return { Page, route };
};

/** The page module of `/terms/versions/:version/changes` or its Privacy twin. */
export const legalChangesPage = (documentType: LegalDocumentType) => {
  const Page = ({
    loaderData,
    navigate,
    search,
  }: PluginRoutePageProps<
    LegalVersionRouteData & { from?: number },
    LegalChangesSearch
  >) => (
    <LegalChangesRouteContent
      documentType={loaderData.documentType}
      from={search.from}
      onFromChange={from => {
        void navigate({
          resetScroll: false,
          search: from === undefined ? {} : { from },
        });
      }}
      version={loaderData.version}
    />
  );

  const route = defineRoute<
    LegalVersionRouteData & { from?: number },
    LegalChangesSearch
  >({
    load: async ({ context, params, search, t }) =>
      await loadLegalChangesRoute({
        ...context,
        documentType,
        from: search.from,
        t,
        version: parseLegalVersionParam(params.version),
      }),
    head: ({ loaderData }) => ({
      description: loaderData?.description,
      robots: "index, follow",
      title: loaderData?.title,
    }),
  });

  return { Page, route };
};
