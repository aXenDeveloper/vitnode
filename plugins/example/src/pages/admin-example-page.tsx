import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

const AdminExamplePage = () => {
  const t = useTranslations("@vitnode/example.admin.overview");

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("title")}
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>{t("points.shell")}</li>
        <li>{t("points.path")}</li>
        <li>{t("points.nav")}</li>
      </ul>
    </div>
  );
};

const AdminExampleBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.admin.overview");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute({
  breadcrumb: AdminExampleBreadcrumb,
  // Inherited from the host's `_admin` route, which declares it once for the
  // whole panel - restated here because a plugin cannot rely on an application
  // having done so, and an AdminCP page must never be indexed.
  head: () => ({ robots: "noindex, nofollow" }),
});

export default AdminExamplePage;
