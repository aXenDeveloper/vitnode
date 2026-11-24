import { LockKeyholeIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const LazyPasscodeDialog = React.lazy(async () => ({
  default: (await import("./passcode-dialog")).PasscodeDialog,
}));

/** Above the chat list when a role requires a passcode the member hasn't set. */
export const ChatPasscodeRequired = ({ userId }: { userId: number }) => {
  const t = useTranslations("core.global.chat.e2e.required");
  const [open, setOpen] = React.useState(false);

  return (
    <Alert className="m-2 w-auto">
      <LockKeyholeIcon aria-hidden="true" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        {t("desc")}
        <Button
          onClick={() => {
            setOpen(true);
          }}
          size="sm"
        >
          <LockKeyholeIcon aria-hidden="true" />
          {t("setup")}
        </Button>
      </AlertDescription>
      {open ? (
        <React.Suspense fallback={null}>
          <LazyPasscodeDialog
            mode="setup"
            onClose={() => {
              setOpen(false);
            }}
            userId={userId}
          />
        </React.Suspense>
      ) : null}
    </Alert>
  );
};
