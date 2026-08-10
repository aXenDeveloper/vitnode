"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

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
import { Link } from "@/lib/navigation";

import type { ContentFormProps } from "./content-form";

// The form pulls in AutoForm and every field component, so it only loads once
// the dialog is actually opened.
const ContentForm = dynamic(async () =>
  import("./content-form").then(mod => ({ default: mod.ContentForm })),
);

/**
 * The Create button.
 *
 * With `admin.create.mode: "page"` the content type is given `href`, and this is
 * an ordinary link - not a dialog that mounts and immediately redirects. Nothing
 * of the form is downloaded until the page it points at is actually requested.
 */
export const CreateContentAction = ({
  href,
  singular,
  ...props
}: Omit<ContentFormProps, "data"> & { href?: string }) => {
  const t = useTranslations("core.content.create");

  if (href) {
    return (
      <Button nativeButton={false} render={<Link href={href} />}>
        <PlusIcon />
        {t("title", { name: singular })}
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        {t("title", { name: singular })}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title", { name: singular })}</DialogTitle>
          <DialogDescription>{t("desc", { name: singular })}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <ContentForm singular={singular} {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
