import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

export const ReportStatusBadge = ({
  status,
}: {
  status: "done" | "in_progress" | "new";
}) => {
  const t = useTranslations("core.moderation.statuses");

  return (
    <Badge
      variant={
        status === "new"
          ? "warning"
          : status === "done"
            ? "success"
            : "secondary"
      }
    >
      {t(status)}
    </Badge>
  );
};

export const useTargetLabel = () => {
  const tRoot = useTranslations();

  return (label: null | string, fallback: string): string =>
    label && tRoot.has(label as never)
      ? tRoot(label as never, { count: 1 } as never)
      : fallback;
};
