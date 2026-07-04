import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  LoaderIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

export type QueueTaskStatus = "completed" | "failed" | "pending" | "processing";

export const QueueStatusBadge = ({ status }: { status: QueueTaskStatus }) => {
  const t = useTranslations("admin.advanced.queue.status");

  if (status === "processing") {
    return (
      <Badge className="border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400">
        <LoaderIcon className="animate-spin" /> {t("processing")}
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400">
        <CircleCheckIcon /> {t("completed")}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="border-destructive/50 bg-destructive/10 text-destructive">
        <CircleXIcon /> {t("failed")}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <ClockIcon /> {t("pending")}
    </Badge>
  );
};
