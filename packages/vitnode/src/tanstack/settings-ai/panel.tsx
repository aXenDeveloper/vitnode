import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";
import { AiUsageContent } from "@/views/auth/settings/ai/ai-usage-content";
import { aiUsageQueryOptions } from "@/views/auth/settings/ai/ai-usage-query";

const AiUsageHeading = () => {
  const t = useTranslations("core.auth.settings.ai");
  const tSettings = useTranslations("core.auth.settings");

  return (
    <PageTitle
      className="mb-0"
      desc={t("desc")}
      h1={t("title")}
      subtitle={tSettings("title")}
    />
  );
};

export const AiUsagePanelContent = ({ userId }: { userId: number }) => {
  const { data: usage } = useSuspenseQuery(aiUsageQueryOptions({ userId }));

  return (
    <>
      <AiUsageHeading />
      <AiUsageContent usage={usage} userId={userId} />
    </>
  );
};
