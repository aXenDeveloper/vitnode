import { TriangleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

import type { ContentMoreActionSystemLogs } from "../actions/more/content";

export const BadgeTypeLog = ({
  type,
}: Pick<React.ComponentProps<typeof ContentMoreActionSystemLogs>, "type">) => {
  const t = useTranslations("admin.debug.logs.types");

  if (type === "warn") {
    return (
      <Badge className="border-warn/50" variant="warning">
        <TriangleAlertIcon /> {t(type)}
      </Badge>
    );
  }

  if (type === "error") {
    return (
      <Badge className="border-destructive/50" variant="destructive">
        <XIcon /> {t(type)}
      </Badge>
    );
  }

  return <Badge>{t(type)}</Badge>;
};
