import { ExternalLinkIcon } from "lucide-react";
import { useTranslations } from "use-intl";

export const NewTabIndicator = () => {
  const t = useTranslations("core.global");

  return (
    <>
      <ExternalLinkIcon
        aria-hidden
        className="text-muted-foreground ms-auto size-3.5"
      />
      <span className="sr-only">{t("opens_in_new_tab")}</span>
    </>
  );
};
