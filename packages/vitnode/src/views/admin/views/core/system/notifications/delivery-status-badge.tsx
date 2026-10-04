import {
  CircleCheckIcon,
  CircleMinusIcon,
  CircleXIcon,
  ClockIcon,
  LoaderIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";

import type { NotificationDeliveryStatus } from "./statuses";

export const DeliveryStatusBadge = ({
  status,
}: {
  status: NotificationDeliveryStatus;
}) => {
  const t = useTranslations("admin.system.notifications.status");

  if (status === "sent") {
    return (
      <Badge variant="success">
        <CircleCheckIcon aria-hidden /> {t("sent")}
      </Badge>
    );
  }

  if (status === "failed") {
    return (
      <Badge variant="destructive">
        <CircleXIcon aria-hidden /> {t("failed")}
      </Badge>
    );
  }

  if (status === "sending") {
    return (
      <Badge variant="secondary">
        <LoaderIcon aria-hidden className="motion-safe:animate-spin" />{" "}
        {t("sending")}
      </Badge>
    );
  }

  if (status === "skipped") {
    return (
      <Badge variant="outline">
        <CircleMinusIcon aria-hidden /> {t("skipped")}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary">
      <ClockIcon aria-hidden /> {t("pending")}
    </Badge>
  );
};
