import React from "react";
import { useTranslations } from "use-intl";

import type {
  ModerationReportSnapshot,
  ModerationSnapshotField,
} from "@/lib/moderation/snapshot";

import { DateFormat } from "@/components/date-format";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isRichTextDocument } from "@/content/rich-text/document";

import type { ReportPerson } from "./report-tone";

import { PersonName } from "./report-tone";
import { SnapshotView } from "./snapshot-view";

interface TextNode {
  content?: TextNode[];
  text?: string;
  type: string;
}

const plainText = (node: TextNode): string =>
  node.text ?? (node.content ?? []).map(plainText).join(" ");

const excerptOf = (fields: ModerationSnapshotField[]): string => {
  for (const field of fields) {
    if (field.kind === "richText" && isRichTextDocument(field.value)) {
      const text = plainText(field.value).replaceAll(/\s+/g, " ").trim();
      if (text) return text;
    }
    if (field.kind === "text" && field.value) return field.value;
  }

  return "";
};

export const SnapshotPeek = ({
  author,
  reportId,
  snapshot,
  typeLabel,
}: {
  author: null | Pick<ReportPerson, "name" | "role">;
  reportId: number;
  snapshot: ModerationReportSnapshot;
  typeLabel: string;
}) => {
  const t = useTranslations("core.moderation.modcp.detail.snapshot_card");
  const [isOpen, setIsOpen] = React.useState(false);
  const excerpt = excerptOf(snapshot.fields);

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <button
        className="bg-muted/40 ring-foreground/10 hover:bg-muted/70 focus-visible:ring-ring/50 flex w-full flex-col gap-1 rounded-xl p-4 text-start ring-1 transition-colors outline-none focus-visible:ring-3"
        onClick={() => {
          setIsOpen(true);
        }}
        type="button"
      >
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          {t.rich("meta", {
            author: () =>
              author ? <PersonName className="text-xs" person={author} /> : "-",
            date: () => <DateFormat date={snapshot.capturedAt} />,
            type: typeLabel,
          })}
        </span>
        {snapshot.title ? (
          <span className="text-foreground line-clamp-1 font-medium">
            {snapshot.title}
          </span>
        ) : null}
        {excerpt ? (
          <span className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {excerpt}
          </span>
        ) : null}
        <span className="text-primary mt-1 text-sm font-medium">
          {t("view")}
        </span>
      </button>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t("sheet_title")}</SheetTitle>
          <SheetDescription>
            {t("sheet_desc", { id: reportId })}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <SnapshotView snapshot={snapshot} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
