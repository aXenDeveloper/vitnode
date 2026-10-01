import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import type { ApplySsoImport } from "./sso-connections-mutations";
import type {
  SsoConnectionProvider,
  SsoImportPreviewApi,
} from "./sso-connections-query";

const ImportPreviewForm = React.lazy(async () =>
  import("./import-preview-form").then(module => ({
    default: module.ImportPreviewForm,
  })),
);

const ImportPreviewSkeleton = ({ label }: { label: string }) => (
  <div aria-busy="true" className="flex flex-col gap-4" role="status">
    <span className="sr-only">{label}</span>
    <Skeleton className="h-14 w-full rounded-md" />
    <Skeleton className="h-14 w-full rounded-md" />
    <div className="flex justify-end gap-2">
      <Skeleton className="h-9 w-20 rounded-md" />
      <Skeleton className="h-9 w-32 rounded-md" />
    </div>
  </div>
);

export const ImportPreviewDialog = ({
  currentAvatarUrl,
  onApply,
  onClose,
  preview,
  providerId,
  providers,
}: {
  currentAvatarUrl: null | string;
  onApply: ApplySsoImport;
  onClose: () => void;
  preview: null | SsoImportPreviewApi | undefined;
  providerId: string;
  providers: SsoConnectionProvider[];
}) => {
  const t = useTranslations("core.auth.settings.sso");
  const tGlobal = useTranslations("core.global");
  const providerName =
    providers.find(provider => provider.id === providerId)?.name ?? providerId;

  return (
    <Dialog
      onOpenChange={open => {
        if (!open) onClose();
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-balance">
            {preview === null
              ? t("errors.preview_not_found.title")
              : t("preview.title", { provider: providerName })}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {preview === null
              ? t("errors.preview_not_found.desc")
              : t("preview.desc")}
          </DialogDescription>
        </DialogHeader>

        {preview === undefined ? (
          <ImportPreviewSkeleton label={t("preview.loading")} />
        ) : null}

        {preview === null ? (
          <div className="flex justify-end">
            <Button onClick={onClose} variant="outline">
              {tGlobal("close")}
            </Button>
          </div>
        ) : null}

        {preview ? (
          <React.Suspense
            fallback={<ImportPreviewSkeleton label={t("preview.loading")} />}
          >
            <ImportPreviewForm
              currentAvatarUrl={currentAvatarUrl}
              onApply={onApply}
              onClose={onClose}
              preview={preview}
              providerId={providerId}
              providerName={providerName}
              providers={providers}
            />
          </React.Suspense>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
