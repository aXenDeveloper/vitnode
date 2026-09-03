import { definePluginRoute } from "@vitnode/core/routing";
import { useTranslations } from "use-intl";

const GuideLayout = ({ children }: { children: React.ReactNode }) => {
  const t = useTranslations("@vitnode/example.guide");

  return (
    <div className="container mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t("title")}
        </h1>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      {children}
    </div>
  );
};

const GuideBreadcrumb = () => {
  const t = useTranslations("@vitnode/example.guide");

  return <span>{t("title")}</span>;
};

export const route = definePluginRoute({
  head: () => ({ robots: "index, follow" }),
  breadcrumb: GuideBreadcrumb,
});

export default GuideLayout;
