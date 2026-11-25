import type { RichTextDocument } from "@vitnode/api/content/rich-text/document";
import type { LegalComparison } from "@vitnode/api/lib/legal/contract";

import { cn } from "cn";
import { MinusIcon, PencilIcon, PlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Block = LegalComparison["blocks"][number];

const asDocument = (node: unknown): RichTextDocument => ({
  content: node && typeof node === "object" ? [node as never] : [],
  type: "doc",
});

const KIND_ICON = {
  added: PlusIcon,
  changed: PencilIcon,
  removed: MinusIcon,
} as const;

const KIND_TONE = {
  added: "border-s-success",
  changed: "border-s-warn",
  removed: "border-s-destructive",
} as const;

const ChangedBlock = ({ block }: { block: Block }) => {
  const t = useTranslations("core.legal.compare");
  if (block.kind === "unchanged") {
    return (
      <RichTextContent
        className="text-muted-foreground"
        content={asDocument(block.after)}
      />
    );
  }
  const Icon = KIND_ICON[block.kind];

  return (
    <section
      aria-label={t(`kinds.${block.kind}`)}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-s-4 p-4",
        KIND_TONE[block.kind],
      )}
    >
      <Badge
        variant={
          block.kind === "added"
            ? "success"
            : block.kind === "removed"
              ? "destructive"
              : "warning"
        }
      >
        <Icon aria-hidden="true" />
        {t(`kinds.${block.kind}`)}
      </Badge>
      {block.kind === "changed" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <del className="flex flex-col gap-1 no-underline">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              {t("before")}
            </span>
            <RichTextContent
              className="text-muted-foreground line-through decoration-1"
              content={asDocument(block.before)}
            />
          </del>
          <ins className="flex flex-col gap-1 no-underline">
            <span className="text-muted-foreground text-xs font-medium uppercase">
              {t("after")}
            </span>
            <RichTextContent content={asDocument(block.after)} />
          </ins>
        </div>
      ) : block.kind === "removed" ? (
        <del className="no-underline">
          <RichTextContent
            className="text-muted-foreground line-through decoration-1"
            content={asDocument(block.before)}
          />
        </del>
      ) : (
        <ins className="no-underline">
          <RichTextContent content={asDocument(block.after)} />
        </ins>
      )}
    </section>
  );
};

/**
 * Block-by-block changes between two versions. Every change carries a text
 * label and `<ins>`/`<del>` semantics, so color only reinforces it. Runs of
 * unchanged blocks fold away behind a toggle.
 */
export const LegalComparisonBlocks = ({
  comparison,
}: {
  comparison: Pick<LegalComparison, "blocks" | "stats">;
}) => {
  const t = useTranslations("core.legal.compare");
  const [showUnchanged, setShowUnchanged] = React.useState(false);
  const unchangedCount = comparison.blocks.filter(
    block => block.kind === "unchanged",
  ).length;
  const hasChanges =
    comparison.stats.added +
      comparison.stats.changed +
      comparison.stats.removed >
    0;

  return (
    <div className="flex flex-col gap-4">
      <ul aria-label={t("with")} className="flex flex-wrap gap-2">
        {(["added", "changed", "removed"] as const).map(kind => (
          <li key={kind}>
            <Badge variant="outline">
              {t(`kinds.${kind}`)}: {comparison.stats[kind]}
            </Badge>
          </li>
        ))}
      </ul>

      {hasChanges ? null : (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("no_changes")}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {comparison.blocks.map((block, index) =>
          block.kind === "unchanged" && !showUnchanged ? null : (
            // Blocks have no identity of their own; a comparison never
            // reorders, so the position is a stable key.
            // oxlint-disable-next-line react/no-array-index-key
            <ChangedBlock block={block} key={index} />
          ),
        )}
      </div>

      {unchangedCount > 0 ? (
        <Button
          className="self-start print:hidden"
          onClick={() => {
            setShowUnchanged(value => !value);
          }}
          variant="outline"
        >
          {showUnchanged
            ? t("hide_unchanged")
            : t("show_unchanged", { count: unchangedCount })}
        </Button>
      ) : null}
    </div>
  );
};
