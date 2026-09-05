import { useTranslations } from "use-intl";

const GuideIndexPage = () => {
  const t = useTranslations("@vitnode/example.guide");

  return (
    <div className="flex flex-col gap-4">
      <p className="leading-relaxed text-pretty">{t("index.intro")}</p>

      <ul className="text-muted-foreground flex list-disc flex-col gap-2 pl-5 leading-relaxed">
        <li>{t("index.points.nested")}</li>
        <li>{t("index.points.messages")}</li>
        <li>{t("index.points.breadcrumb")}</li>
      </ul>
    </div>
  );
};

export default GuideIndexPage;
