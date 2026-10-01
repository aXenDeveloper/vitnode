import { DownloadIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import type { SsoProfileField } from "@/lib/sso-profile";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import type { StartSsoConnection } from "./sso-connections-mutations";

const ImportFieldsForm = React.lazy(async () =>
  import("./import-fields-form").then(module => ({
    default: module.ImportFieldsForm,
  })),
);

const ImportFieldsFormSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-4">
    <Skeleton className="h-10 w-full rounded-md" />
    <Skeleton className="h-10 w-full rounded-md" />
    <Skeleton className="h-10 w-full rounded-md" />
    <div className="flex justify-end">
      <Skeleton className="h-9 w-40 rounded-md" />
    </div>
  </div>
);

export const ImportSsoButton = ({
  fields,
  onStart,
  providerId,
  providerName,
}: {
  fields: SsoProfileField[];
  onStart: StartSsoConnection;
  providerId: string;
  providerName: string;
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const hasAvatar = fields.includes("avatar");
  const hasName = fields.includes("firstName") || fields.includes("lastName");
  const action = t(
    hasAvatar && hasName
      ? "import.action_all"
      : hasAvatar
        ? "import.action_avatar"
        : "import.action_name",
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            aria-label={t("import.aria", { action, provider: providerName })}
            size="sm"
            variant="ghost"
          />
        }
      >
        <DownloadIcon aria-hidden="true" />
        {action}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-balance">
            {t("import.title", { provider: providerName })}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {t("import.desc", { provider: providerName })}
          </DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<ImportFieldsFormSkeleton />}>
          <ImportFieldsForm
            fields={fields}
            onStart={onStart}
            providerId={providerId}
            providerName={providerName}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
