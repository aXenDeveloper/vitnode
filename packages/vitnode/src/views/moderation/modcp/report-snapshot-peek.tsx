import { ExternalLinkIcon } from "lucide-react";
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
  contentUrl,
  reportId,
  snapshot,
  typeLabel,
}: {
  author: null | Pick<ReportPerson, "name" | "role">;
  contentUrl: null | string;
  reportId: number;
  snapshot: ModerationReportSnapshot;
  typeLabel: string;
}) => {
  const t = useTranslations("core.moderation.modcp.detail");
  const [isOpen, setIsOpen] = React.useState(false);
  const excerpt = excerptOf(snapshot.fields);

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <div className="bg-muted/40 ring-foreground/10 flex w-full flex-col gap-1 rounded-xl p-4 ring-1">
        <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          {t.rich("snapshot_card.meta", {
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
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
          <button
            className="text-primary focus-visible:ring-ring/50 rounded-sm outline-none hover:underline focus-visible:ring-3"
            onClick={() => {
              setIsOpen(true);
            }}
            type="button"
          >
            {t("snapshot_card.view")}
          </button>
          {contentUrl ? (
            <a
              className="text-primary focus-visible:ring-ring/50 inline-flex items-center gap-1.5 rounded-sm outline-none hover:underline focus-visible:ring-3"
              href={contentUrl}
              rel="noopener"
              target="_blank"
            >
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              {t("current.open")}
            </a>
          ) : null}
        </div>
      </div>
      <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{t("snapshot_card.sheet_title")}</SheetTitle>
          <SheetDescription>
            {t("snapshot_card.sheet_desc", { id: reportId })}
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          <SnapshotView snapshot={snapshot} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
