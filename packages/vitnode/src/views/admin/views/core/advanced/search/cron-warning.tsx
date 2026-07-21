"use client";

import { TriangleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export const CronWarning = () => {
  const t = useTranslations("core.search");
  const [dismissed, setDismissed] = React.useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <Alert variant="warning">
      <TriangleAlertIcon />
      <AlertTitle>{t("admin.cron.title")}</AlertTitle>
      <AlertDescription>{t("admin.cron.desc")}</AlertDescription>
      <AlertAction>
        <Button
          aria-label={t("admin.cron.dismiss")}
          className="text-muted-foreground hover:text-foreground size-7"
          onClick={() => setDismissed(true)}
          size="icon"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </AlertAction>
    </Alert>
  );
};
