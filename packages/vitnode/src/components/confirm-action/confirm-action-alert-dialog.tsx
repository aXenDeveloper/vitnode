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
