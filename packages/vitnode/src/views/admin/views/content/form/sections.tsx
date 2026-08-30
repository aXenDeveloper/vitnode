// No "use client": reached only from `content-form`, which is already a client
// entry - the same reason the primitives beside it declare none.
import React from "react";
import { useTranslations } from "use-intl";

import type { ContentFormSectionSpec } from "@/content/admin/spec";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter, useDialog } from "@/components/ui/dialog";

import { useContentForm } from "./context";
import {
  ContentFormField,
  ContentFormRemainingFields,
  ContentFormSection,
  ContentFormSubmit,
} from "./primitives";

const ContentFormSectionsFooter = () => {
  const t = useTranslations("core.global");
  const { setIsDirty } = useDialog();

  if (!setIsDirty) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ContentFormSubmit />
      </div>
    );
  }

  return (
    <DialogFooter>
      <DialogClose render={<Button variant="ghost">{t("cancel")}</Button>} />
      <ContentFormSubmit />
    </DialogFooter>
  );
};

export const ContentFormSections = ({
  sections,
}: {
  sections: readonly ContentFormSectionSpec[];
}) => {
  const { fieldNames } = useContentForm();
  const placed = new Set(sections.flatMap(section => section.fields));
  const hasRemaining = fieldNames.some(name => !placed.has(name));

  return (
    <div className="flex flex-col gap-4">
      {sections.map(section => (
        <ContentFormSection
          desc={section.desc}
          key={section.name}
          title={section.title}
        >
          {section.fields.map(name => (
            <ContentFormField key={name} name={name} />
          ))}
        </ContentFormSection>
      ))}

      {hasRemaining ? (
        <div className="flex flex-col gap-6">
          <ContentFormRemainingFields exclude={[...placed]} />
        </div>
      ) : null}

      <ContentFormSectionsFooter />
    </div>
  );
};
