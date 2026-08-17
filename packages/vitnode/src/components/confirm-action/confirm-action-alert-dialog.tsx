"use client";

import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooterSkeleton,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";

const ContentConfirmAction = dynamic(async () =>
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
    /**
     * The element that opens the dialog.
     *
     * Optional, for a caller that owns `open` itself - a confirmation opened from
     * a menu item has no trigger to render, because the item is gone by the time
     * the dialog is on screen.
     */
    children?: React.ReactElement;
    description?: React.ReactNode;
    /** Where focus goes on close, for a dialog whose trigger no longer exists. */
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
