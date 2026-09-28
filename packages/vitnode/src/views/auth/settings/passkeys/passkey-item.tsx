import { cn } from "cn";
import { KeyRoundIcon, PencilIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { DateFormat } from "@/components/date-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { DeletePasskey, RenamePasskey } from "./passkeys-mutations";
import type { Passkey } from "./passkeys-query";

import { SETTINGS_ROW } from "../settings-group";
import { DeletePasskeyButton } from "./delete-passkey-button";

const PasskeyNameEditor = React.lazy(async () =>
  import("./passkey-name-editor").then(module => ({
    default: module.PasskeyNameEditor,
  })),
);

const PasskeyNameEditorSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-3 px-4 py-4">
    <Skeleton className="h-14 w-full rounded-md" />
    <div className="flex justify-end gap-2">
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-9 w-20 rounded-md" />
    </div>
  </div>
);

export const PasskeyItem = ({
  isPasswordEnabled,
  onDelete,
  onRename,
  passkey,
}: {
  isPasswordEnabled: boolean;
  onDelete: DeletePasskey;
  onRename: RenamePasskey;
  passkey: Passkey;
}) => {
  const t = useTranslations("core.auth.settings.passkeys");
  const [isEditing, setIsEditing] = React.useState(false);
  const renameButtonRef = React.useRef<HTMLButtonElement>(null);

  if (isEditing) {
    return (
      <li>
        <React.Suspense fallback={<PasskeyNameEditorSkeleton />}>
          <PasskeyNameEditor
            id={passkey.id}
            name={passkey.name}
            onClose={() => {
              setIsEditing(false);
              requestAnimationFrame(() => renameButtonRef.current?.focus());
            }}
            onRename={onRename}
          />
        </React.Suspense>
      </li>
    );
  }

  const storage = passkey.backedUp
    ? t("synced")
    : passkey.deviceType === "singleDevice"
      ? t("device_bound")
      : null;

  const facts = [
    { label: t("added"), value: <DateFormat date={passkey.createdAt} /> },
    {
      label: t("last_used"),
      value: passkey.lastUsedAt ? (
        <DateFormat date={passkey.lastUsedAt} />
      ) : (
        t("never_used")
      ),
    },
  ];

  return (
    <li className={cn(SETTINGS_ROW, "items-start")}>
      <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
        <KeyRoundIcon aria-hidden="true" className="size-5" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-medium wrap-anywhere">
            {passkey.name}
          </span>
          {storage ? <Badge variant="secondary">{storage}</Badge> : null}
        </span>
        <dl className="flex flex-col gap-1 text-sm sm:grid sm:grid-cols-2 sm:gap-x-6">
          {facts.map(({ label, value }) => (
            <div
              className="flex min-w-0 gap-3 sm:flex-col sm:gap-0.5"
              key={label}
            >
              <dt className="text-muted-foreground w-28 shrink-0 sm:w-auto">
                {label}
              </dt>
              <dd className="text-foreground min-w-0 wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-label={t("rename.action")}
                  className="relative after:absolute after:-inset-1.5"
                  onClick={() => {
                    setIsEditing(true);
                  }}
                  ref={renameButtonRef}
                  size="icon-sm"
                  variant="ghost"
                >
                  <PencilIcon />
                </Button>
              }
            />
            <TooltipContent>{t("rename.action")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DeletePasskeyButton
          id={passkey.id}
          isPasswordEnabled={isPasswordEnabled}
          name={passkey.name}
          onDelete={onDelete}
        />
      </div>
    </li>
  );
};
