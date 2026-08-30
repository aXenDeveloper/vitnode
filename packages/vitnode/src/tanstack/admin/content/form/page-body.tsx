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

/**
 * What a page-mode create or edit URL actually renders, once it is that URL.
 *
 * Behind `React.lazy` from `./screen`, and the split is the whole reason this
 * file exists. Everything here reaches `ContentFormPage`, and from there
 * `ContentForm` and the entire `AutoForm` stack with every field component it
 * can mount - which is the largest thing the Content Engine contributes to a
 * bundle after the editors a plugin brings. A content *list* renders none of it.
 *
 * Until this was split out, `./screen` imported it directly, so the composition
 * module pulled the form stack into the content route's chunk for every
 * navigation - including the list screens of dialog-mode content types, which
 * never render a form page at all. The dialog's own `React.lazy` boundary in
 * `./dialog` could not help: it pointed at `./form-body`, which the same
 * eagerly-imported module also reached.
 *
 * The same arrangement `./dialog` and `./form-body` make one screen over: a thin
 * eager module that decides *whether* a form is wanted, and a lazy one that is
 * the form. The loader half - `loadContentFormScreen` - deliberately stays eager
 * in `./screen`, because the route's `loader` calls it before anything renders.
 */

/** The layout a page-mode screen renders under, or the generated arrangement. */
export const contentPageLayout = (
  entry: RegisteredFrontendContentType,
  mode: "create" | "edit",
) => resolveContentFormLayout(entry.registration.forms, mode);

/**
 * The back link every form page carries, the noun it names, and the spec.
 *
 * The heading's own strings are *not* here: `core.content.create` and
 * `core.content.edit` are two namespaces, and `useTranslations` takes a literal
 * one - so each screen reads its own, which is also the only reading that keeps
 * the key union honest.
 */
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
  const { back, backHref, fieldOverrides, labels, spec } = useFormPage(entry);
  const singular = labels.singular;

  return (
    <ContentFormPage
      backHref={backHref}
      /**
       * Where a create lands.
       *
       * The record's own edit page when this content type edits in a page, and
       * the list otherwise - exactly what `ContentCreatePageView` decides, from
       * the same flag. `{id}` is filled in by `ContentFormPage` once the API has
       * said which record was created; guessing at it would open another one.
       */
      createdHrefTemplate={
        entry.definition.admin.edit.mode === "page"
          ? contentEditHrefTemplate(entry.definition)
          : undefined
      }
      fieldOverrides={fieldOverrides}
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
  const { back, backHref, fieldOverrides, labels, spec } = useFormPage(entry);
  const singular = labels.singular;
  const request = {
    contentTypeId: entry.definition.id,
    itemId,
    target: contentApiTarget(entry.definition, entry.pluginId),
  };

  /**
   * Read back rather than passed down, and from the entries the loader warmed.
   *
   * `useSuspenseQuery` on an entry that is already there does not suspend, so
   * the form is populated in the first paint. It is also what makes an edit that
   * commits show its own result: the transport invalidates
   * `contentItemQueryRoot` after a successful save, so these two refetch and the
   * heading follows the title that was just typed.
   */
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

/**
 * The create form or the edit form, chosen from the action the route resolved.
 *
 * One component rather than two lazy imports, because the two screens share
 * `useFormPage`, the spec build and `ContentFormPage` - splitting them would
 * produce two chunks that are almost entirely the same bytes, and a create
 * followed by "edit what you just made" would fetch both.
 */
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
