import { useTranslations } from "use-intl";

import { Card, CardContent } from "@/components/ui/card";
import { HeaderContent } from "@/components/ui/header-content";

export const SettingsShellContent = ({
  children,
  footer,
  header,
  nav,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  nav: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.settings");

  return (
    <div className="container mx-auto flex flex-col gap-6 px-4">
      {header}
      <HeaderContent className="mb-0" desc={t("desc")} h1={t("title")} />

      <div className="flex flex-col items-start gap-6 md:flex-row">
        <Card className="w-full md:w-80 md:shrink-0">
          <CardContent>{nav}</CardContent>
        </Card>

        <Card className="w-full min-w-0 flex-1">
          <CardContent>{children}</CardContent>
        </Card>
      </div>
      {footer}
    </div>
  );
};
