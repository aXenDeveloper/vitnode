import { cn } from "cn";
import { useTranslations } from "use-intl";

export const EditorSkeleton = ({ className }: { className?: string }) => {
  const t = useTranslations("core.global");

  return (
    <div
      aria-busy="true"
      className={cn(
        "bg-card flex min-h-52 w-full flex-col rounded-md border shadow-xs",
        className,
      )}
      data-slot="editor-skeleton"
    >
      <div className="bg-muted/40 h-10 shrink-0 rounded-t-md border-b" />
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
    </div>
  );
};
