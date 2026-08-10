import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { z } from "zod";

import type { RegisteredFrontendContentType } from "@/content/admin/config";
import type { ContentFormSpec } from "@/content/admin/spec";

import { Button } from "@/components/ui/button";
import { HeaderContent } from "@/components/ui/header-content";
import { contentApiFetch } from "@/content/admin/fetch.server";
import {
  buildContentFormSpec,
  buildContentTranslationFormSpec,
} from "@/content/admin/spec";
import { CONTENT_PERMISSIONS } from "@/content/const";
import { contentAdminHref, contentEditHrefTemplate } from "@/content/registry";
import { checkAdminPermissionApi } from "@/lib/api/get-session-admin-api";
import { Link } from "@/lib/navigation";
import { resolveContentFormLayout } from "@/lib/plugin";

import { getContentLabels } from "../content-admin-view";
import { ContentFormPage } from "./content-form-page";

/** The row shape a form opens on: the record, plus its reference labels. */
const zodDetail = z
  .object({
    id: z.number(),
    labels: z.record(z.string(), z.string().nullable()),
  })
  .loose();

const fieldOverridesOf = (entry: RegisteredFrontendContentType) =>
  Object.fromEntries(
    Object.entries(entry.registration.fields ?? {}).map(([name, override]) => [
      name,
      override.component,
    ]),
  );

/**
 * The specs a form page needs, and the labels its headings use.
 *
 * Identical to what the list screen builds for its dialogs - page mode changes
 * where the form is, not what the form is.
 */
const buildPageSpecs = async (entry: RegisteredFrontendContentType) => {
  const { definition, pluginId } = entry;
  const labels = await getContentLabels(entry);
  const shared = {
    definition,
    labelEnum: labels.labelEnum,
    labelField: labels.labelField,
    pluginId,
  };

  return {
    labels,
    spec: buildContentFormSpec(shared),
    translationSpec: buildContentTranslationFormSpec(shared),
  } satisfies {
    labels: Awaited<ReturnType<typeof getContentLabels>>;
    spec: ContentFormSpec;
    translationSpec: ContentFormSpec | null;
  };
};

/**
 * The generated **create page**.
 *
 * Reachable only with `can_view` *and* `can_create`, checked here rather than
 * inferred from whether a button was rendered - a URL typed into the address bar
 * has to answer the same way the button would have. The generated `POST` checks
 * again, which is the check that actually stops the write.
 */
export const ContentCreatePageView = async ({
  entry,
}: {
  entry: RegisteredFrontendContentType;
}) => {
  const { definition, pluginId, registration } = entry;

  const [t, tPage, canView, canCreate] = await Promise.all([
    getTranslations("core.content.create"),
    getTranslations("core.content.page"),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.view,
      plugin: pluginId,
    }),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.create,
      plugin: pluginId,
    }),
  ]);

  if (!canView || !canCreate) notFound();

  const { spec } = await buildPageSpecs(entry);
  const singular = definition.admin.label.singular;
  const backHref = contentAdminHref(definition.id);

  return (
    <div className="p-4">
      <HeaderContent
        desc={t("desc", { name: singular })}
        h1={t("title", { name: singular })}
      >
        <Button render={<Link href={backHref} />} variant="outline">
          <ArrowLeftIcon />
          {tPage("back", { name: definition.admin.label.plural })}
        </Button>
      </HeaderContent>

      <ContentFormPage
        backHref={backHref}
        // A localized content type has nothing to translate until the record
        // exists, so a create always hands over to the edit page when there is
        // one. Everything else goes back to the list.
        createdHrefTemplate={
          definition.admin.edit.mode === "page"
            ? contentEditHrefTemplate(definition.id)
            : undefined
        }
        fieldOverrides={fieldOverridesOf(entry)}
        layout={resolveContentFormLayout(registration.forms, "create")}
        permissionModule={definition.permissionModule}
        pluginId={pluginId}
        publication={definition.publication.enabled}
        singular={singular}
        spec={spec}
      />
    </div>
  );
};

/**
 * The generated **edit page**.
 *
 * Reachable with `can_edit`, or with `can_translate` on a localized content type
 * - the same pair the edit dialog opens for, because a translator who may not
 * touch a shared field still needs somewhere to write the Polish copy.
 *
 * A record that does not exist is a 404, and so is one whose content type the
 * session may not view: the read goes through the generated API, which enforces
 * `can_view` itself, so a missing permission and a missing row are the same
 * answer from here.
 */
export const ContentEditPageView = async ({
  entry,
  itemId,
}: {
  entry: RegisteredFrontendContentType;
  itemId: number;
}) => {
  const { definition, pluginId, registration } = entry;
  const localized = definition.localization.enabled;

  const [t, tPage, canView, canEdit, canTranslate] = await Promise.all([
    getTranslations("core.content.edit"),
    getTranslations("core.content.page"),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.view,
      plugin: pluginId,
    }),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.edit,
      plugin: pluginId,
    }),
    checkAdminPermissionApi({
      module: definition.permissionModule,
      permission: CONTENT_PERMISSIONS.translate,
      plugin: pluginId,
    }),
  ]);

  if (!canView) notFound();
  if (!canEdit && !(localized && canTranslate)) notFound();

  const result = await contentApiFetch({
    definition,
    method: "get",
    path: `/${itemId}`,
    pluginId,
    schema: zodDetail,
  });

  if (result.status !== 200 || !result.data) notFound();

  const { spec, translationSpec } = await buildPageSpecs(entry);
  const backHref = contentAdminHref(definition.id);
  const singular = definition.admin.label.singular;
  const data = result.data as Record<string, unknown> & { id: number };
  const titleField = definition.admin.titleField;
  const title =
    titleField && typeof data[titleField] === "string"
      ? data[titleField]
      : `#${data.id}`;

  return (
    <div className="p-4">
      <HeaderContent desc={title} h1={t("title", { name: singular })}>
        <Button render={<Link href={backHref} />} variant="outline">
          <ArrowLeftIcon />
          {tPage("back", { name: definition.admin.label.plural })}
        </Button>
      </HeaderContent>

      <ContentFormPage
        backHref={backHref}
        data={data}
        defaultLocale={definition.localization.defaultLocale}
        editorial={definition.editorial.enabled}
        fieldOverrides={fieldOverridesOf(entry)}
        layout={resolveContentFormLayout(registration.forms, "edit")}
        permissionModule={definition.permissionModule}
        pluginId={pluginId}
        publication={definition.publication.enabled}
        singular={singular}
        spec={spec}
        title={title}
        translationSpec={translationSpec}
      />
    </div>
  );
};
