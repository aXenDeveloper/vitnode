import {
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  LoaderIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

export type QueueTaskStatus = "completed" | "failed" | "pending" | "processing";

export const QueueStatusBadge = ({ status }: { status: QueueTaskStatus }) => {
  const t = useTranslations("admin.advanced.queue.status");

  if (status === "processing") {
    return (
      <Badge
        className="border-primary/50 bg-primary/10 text-primary"
        variant="outline"
      >
        <LoaderIcon className="animate-spin" /> {t("processing")}
      </Badge>
    );
  }

  if (status === "completed") {
    return (
      <Badge className="border-success/50" variant="success">
        <CircleCheckIcon /> {t("completed")}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge className="border-destructive/50" variant="destructive">
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
