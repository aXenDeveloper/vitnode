import { TriangleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

import type { ContentMoreActionSystemLogs } from "../actions/more/content";

export const BadgeTypeLog = ({
  type,
}: Pick<React.ComponentProps<typeof ContentMoreActionSystemLogs>, "type">) => {
  const t = useTranslations("admin.debug.logs.types");

  if (type === "warn") {
    return (
      <Badge className="bg-warn/10 border-warn/50 text-warn">
        <TriangleAlertIcon /> {t(type)}
      </Badge>
    );
  }

  if (type === "error") {
    return (
      <Badge className="bg-destructive/10 border-destructive/50 text-destructive">
        <XIcon /> {t(type)}
      </Badge>
    );
  }

  return <Badge>{t(type)}</Badge>;
};
