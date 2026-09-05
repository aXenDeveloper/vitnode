"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import type {
  ContentAdminAction,
  RegisteredFrontendContentType,
} from "@/content/index";
import type { TranslationRow } from "@/views/admin/views/content/content-mutation";

import { contentAdminHref, contentEditHrefTemplate } from "@/content/index";
import { resolveContentFormLayout } from "@/lib/plugin";
import {
  contentItemQueryOptions,
  contentTranslationsQueryOptions,
} from "@/views/admin/views/content/form/item-query";
import { ContentFormPage } from "@/views/admin/views/content/page/content-form-page";

import { contentApiTarget } from "../query";
import { useContentTypeForm } from "./spec";
import { fetchContentItem, fetchContentTranslations } from "./transport";

/** The layout a page-mode screen renders under, or the generated arrangement. */
export const contentPageLayout = (
  entry: RegisteredFrontendContentType,
  mode: "create" | "edit",
) => resolveContentFormLayout(entry.registration.forms, mode);

const useFormPage = (entry: RegisteredFrontendContentType) => {
  const tPage = useTranslations("core.content.page");
  const { labels, ...form } = useContentTypeForm(entry);
  const backHref = contentAdminHref(entry.definition);

  return {
    ...form,
    back: { href: backHref, label: tPage("back", { name: labels.plural }) },
    backHref,
    labels,
  };
};

const ContentCreateScreen = ({
  entry,
}: {
  entry: RegisteredFrontendContentType;
}) => {
  const t = useTranslations("core.content.create");
  const { back, backHref, fieldOverrides, fieldSkeletons, labels, spec } =
    useFormPage(entry);
  const singular = labels.singular;

  return (
    <ContentFormPage
      backHref={backHref}

      createdHrefTemplate={
        entry.definition.admin.edit.mode === "page"
          ? contentEditHrefTemplate(entry.definition)
          : undefined
      }
      fieldOverrides={fieldOverrides}
      fieldSkeletons={fieldSkeletons}
      header={{
        back,
        desc: t("desc", { name: singular }),
        title: t("title", { name: singular }),
      }}
      layout={contentPageLayout(entry, "create")}
      publication={entry.definition.publication.enabled}
      singular={singular}
      spec={spec}
    />
  );
};

const ContentEditScreen = ({
  entry,
  itemId,
  title,
}: {
  entry: RegisteredFrontendContentType;
  itemId: number;
  title: string;
}) => {
  const t = useTranslations("core.content.edit");
  const { back, backHref, fieldOverrides, fieldSkeletons, labels, spec } =
    useFormPage(entry);
  const singular = labels.singular;
  const request = {
    contentTypeId: entry.definition.id,
    itemId,
    target: contentApiTarget(entry.definition, entry.pluginId),
  };

  const { data: row } = useSuspenseQuery(
    contentItemQueryOptions({ fetchItem: fetchContentItem, request }),
  );
  const { data: translations } = useSuspenseQuery({
    ...contentTranslationsQueryOptions({
      fetchTranslations: fetchContentTranslations,
      request,
    }),
    // A content type without translations has no route to ask, and asking would
    // be a 404 on every edit navigation.
    ...(entry.definition.localization.enabled
      ? {}
      : { queryFn: async () => await Promise.resolve<TranslationRow[]>([]) }),
  });

  return (
    <ContentFormPage
      backHref={backHref}
      data={row}
      fieldOverrides={fieldOverrides}
      fieldSkeletons={fieldSkeletons}
      header={{ back, desc: title, title: t("title", { name: singular }) }}
      layout={contentPageLayout(entry, "edit")}
      publication={entry.definition.publication.enabled}
      singular={singular}
      spec={spec}
      title={title}
      translations={translations}
    />
  );
};

export const ContentFormPageBody = ({
  action,
  entry,
  itemId,
  title,
}: {
  action: Exclude<ContentAdminAction, "list">;
  entry: RegisteredFrontendContentType;
  itemId: number;
  title: string;
}) =>
  action === "create" ? (
    <ContentCreateScreen entry={entry} />
  ) : (
    <ContentEditScreen entry={entry} itemId={itemId} title={title} />
  );
