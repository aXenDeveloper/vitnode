"use client";

import { SendIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { sendNotificationMutation } from "./mutation-api";

export const SendNotificationAction = ({
  defaultUserId,
}: {
  defaultUserId: number;
}) => {
  const [userId, setUserId] = React.useState(String(defaultUserId));
  const [title, setTitle] = React.useState("Hello from the admin 👋");
  const [isPending, startTransition] = React.useTransition();

  const onSend = () => {
    startTransition(async () => {
      const res = await sendNotificationMutation({
        title,
        type: "info",
        userId: Number(userId),
      });

      if (res?.error) {
        toast.error("Failed to send notification", { description: res.error });

        return;
      }

      toast.success("Notification sent");
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">User ID</span>
        <Input
          className="w-24"
          onChange={event => setUserId(event.target.value)}
          type="number"
          value={userId}
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Title</span>
        <Input onChange={event => setTitle(event.target.value)} value={title} />
      </label>
      <Button disabled={isPending || !title.trim() || !userId} onClick={onSend}>
        <SendIcon />
        Send notification
      </Button>
    </div>
  );
};
