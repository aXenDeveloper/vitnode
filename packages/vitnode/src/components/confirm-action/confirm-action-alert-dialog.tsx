"use client";

import React from "react";
import { useTranslations } from "use-intl";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooterSkeleton,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

/**
 * `React.lazy` rather than `next/dynamic`, which is what this used to be.
 *
 * The two are the same thing here - this is a client component, the import is
 * already wrapped in the `<React.Suspense>` below, and `next/dynamic` defaults
 * to server rendering the chunk - but only one of them resolves outside a
 * Next.js app. Every confirm dialog in VitNode goes through this component,
 * including the ones on the shared `/files` table, so that single import was
 * enough to make the whole screen Next.js-only.
 */
const ContentConfirmAction = React.lazy(async () =>
  import("./content").then(module => ({
    default: module.ContentConfirmAction,
  })),
);

export const ConfirmActionAlertDialog = ({
  children,
  title,
  description,
  finalFocus,
  submitVariant,
  textSubmit,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialog>, "children"> &
  React.ComponentProps<typeof ContentConfirmAction> & {
    children?: React.ReactElement;
    description?: React.ReactNode;
    finalFocus?: React.ComponentProps<typeof AlertDialogContent>["finalFocus"];
    title?: React.ReactNode;
  }) => {
  const t = useTranslations("core.global.confirm_action");

  return (
    <AlertDialog {...props}>
      {children ? <AlertDialogTrigger render={children} /> : null}

      <AlertDialogContent finalFocus={finalFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <React.Suspense fallback={<AlertDialogFooterSkeleton />}>
          <ContentConfirmAction
            onSubmit={onSubmit}
            submitVariant={submitVariant}
            textSubmit={textSubmit}
          />
        </React.Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
};
