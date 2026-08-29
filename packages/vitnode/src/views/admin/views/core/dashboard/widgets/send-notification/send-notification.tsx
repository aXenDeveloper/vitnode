"use client";

import { SendIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { sendNotificationInBrowser } from "../widget-mutations";

export const SendNotificationAction = ({
  defaultTitle,
  defaultUserId,
}: {
  defaultTitle: string;
  defaultUserId: number;
}) => {
  const t = useTranslations("admin.dashboard.widgets.send-notification");
  const [userId, setUserId] = React.useState(String(defaultUserId));
  const [title, setTitle] = React.useState(
    () => defaultTitle || t("default_message"),
  );
  const [isPending, startTransition] = React.useTransition();

  const onSend = () => {
    startTransition(async () => {
      const res = await sendNotificationInBrowser({
        title,
        type: "info",
        userId: Number(userId),
      });

      if (res?.error) {
        toast.error(t("error"), { description: res.error });

        return;
      }

      toast.success(t("success"), { description: title });
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t("user_id")}</span>
        <Input
          className="w-24"
          onChange={event => setUserId(event.target.value)}
          type="number"
          value={userId}
        />
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t("message")}</span>
        <Input onChange={event => setTitle(event.target.value)} value={title} />
      </label>
      <Button disabled={isPending || !title.trim() || !userId} onClick={onSend}>
        <SendIcon />
        {t("submit")}
      </Button>
    </div>
  );
};
