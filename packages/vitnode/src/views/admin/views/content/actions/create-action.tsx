"use client";

import { PlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { ContentFormProps } from "./content-form";

import { useContentFormNavigation } from "../form/navigation";
import { ContentFormDialog } from "./form-dialog";
import { ContentLinkButton } from "./link-button";

/**
 * The form pulls in AutoForm and every field component, so it only loads once
 * the dialog is actually opened.
 *
 * `React.lazy` rather than `next/dynamic`, which is what this used to be. The
 * two do the same thing here - this is a client component and
 * `ContentFormDialog` renders the form inside a `<React.Suspense>` - but only
 * one of them resolves outside a Next.js application, and this button is on
 * every content list.
 */
const ContentForm = React.lazy(async () =>
  import("./content-form").then(mod => ({ default: mod.ContentForm })),
);

export const CreateContentAction = ({
  href,
  singular,
  ...props
}: Omit<ContentFormProps, "data"> & { href?: string }) => {
  const t = useTranslations("core.content.create");
  const { LinkComponent } = useContentFormNavigation();

  if (href) {
    return (
      <ContentLinkButton href={href} LinkComponent={LinkComponent}>
        <PlusIcon />
        {t("title", { name: singular })}
      </ContentLinkButton>
    );
  }

  return (
    <ContentFormDialog
      description={t("desc", { name: singular })}
      form={<ContentForm singular={singular} {...props} />}
      title={t("title", { name: singular })}
    >
      <Button>
        <PlusIcon />
        {t("title", { name: singular })}
      </Button>
    </ContentFormDialog>
  );
};
