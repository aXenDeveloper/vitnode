import {
  useSuspenseInfiniteQuery,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import { PageTitle } from "@/components/ui/page-title";
import { AiHistoryContent } from "@/views/auth/settings/ai/ai-history-content";
import { AiUsageContent } from "@/views/auth/settings/ai/ai-usage-content";
import {
  aiHistoryQueryOptions,
  aiUsageQueryOptions,
} from "@/views/auth/settings/ai/ai-usage-query";

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
  const history = useSuspenseInfiniteQuery(aiHistoryQueryOptions({ userId }));

  return (
    <>
      <AiUsageHeading />
      <AiUsageContent usage={usage} />
      <AiHistoryContent
        actions={usage.actions}
        hasNextPage={history.hasNextPage}
        isFetchingNextPage={history.isFetchingNextPage}
        items={history.data.pages.flatMap(page => page.items)}
        onLoadMore={() => {
          void history.fetchNextPage();
        }}
      />
    </>
  );
};
