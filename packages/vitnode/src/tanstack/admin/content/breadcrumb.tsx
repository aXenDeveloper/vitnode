import { useTranslations } from "use-intl";

import type { ContentBreadcrumbModel } from "./breadcrumb-model";
import type { ContentAdminRouteData } from "./route";

import { RouteMessages } from "../../i18n/route-messages";
import { AdminBreadcrumb } from "../breadcrumb";
import { contentBreadcrumbModel } from "./breadcrumb-model";

export type ContentAdminBreadcrumbProps = Partial<
  Pick<ContentAdminRouteData, "action" | "adminPath" | "labels" | "namespaces">
>;

export const ContentAdminBreadcrumbContent = ({
  namespaces,
  ...route
}: ContentAdminBreadcrumbProps) => {
  const model = contentBreadcrumbModel(route);

  // The loader did not resolve - see the note above. Nothing below this line
  // has a content type to name, and `RouteMessages` has no namespaces to mount.
  if (model.kind === "none") return null;

  return (
    <RouteMessages namespaces={namespaces ?? []}>
      {model.kind === "list" ? (
        <AdminBreadcrumb
          overrideLastLabel={model.title}
          segments={model.segments}
        />
      ) : (
        <ContentFormCrumb model={model} />
      )}
    </RouteMessages>
  );
};

const ContentFormCrumb = ({
  model,
}: {
  model: Extract<ContentBreadcrumbModel, { kind: "form" }>;
}) => {
  const t = useTranslations("core.content");

  return (
    <AdminBreadcrumb
      labels={{ [model.listHref]: model.title }}
      overrideLastLabel={t(
        model.action === "create" ? "create.title" : "edit.title",
        { name: model.singular },
      )}
      segments={model.segments}
    />
  );
};
