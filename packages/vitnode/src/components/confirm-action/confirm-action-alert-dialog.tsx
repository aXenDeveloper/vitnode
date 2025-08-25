"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
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
  textSubmit,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<typeof AlertDialog>, "children"> &
  React.ComponentProps<typeof ContentConfirmAction> & {
    children: React.ReactNode;
    description?: React.ReactNode;
    title?: React.ReactNode;
  }) => {
  const t = useTranslations("core.global.confirm_action");

  return (
    <AlertDialog {...props}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title ?? t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ?? t("desc")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <React.Suspense fallback={<AlertDialogFooterSkeleton />}>
          <ContentConfirmAction onSubmit={onSubmit} textSubmit={textSubmit} />
        </React.Suspense>
      </AlertDialogContent>
    </AlertDialog>
  );
};
