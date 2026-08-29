"use client";

import { SendIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";

import type { SendTestEmail } from "./send-test-email-mutation";

const ContentSendTestEmail = React.lazy(async () =>
  import("./content").then(module => ({
    default: module.ContentSendTestEmail,
  })),
);

export const SendTestEmailAction = ({ onSend }: { onSend: SendTestEmail }) => {
  const t = useTranslations("admin.system.integrations.email.test");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <SendIcon />
        {t("label")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <ContentSendTestEmail onSend={onSend} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
