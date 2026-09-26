import type { ReactElement, ReactNode } from "react";

import { ChevronLeftIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";

import { useVisualEditor } from "../context";

export const EditorPanelHeader = ({
  actions,
  children,
  description,
  icon,
  leading,
  title,
}: {
  actions?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  leading?: ReactNode;
  title: ReactNode;
}): ReactElement => (
  <header className="border-border bg-card sticky top-0 z-10 flex flex-col gap-3 border-b p-4">
    <div className="flex min-h-9 items-center gap-2">
      {leading}

      {icon === undefined ? null : (
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-sm [&_svg]:size-4"
        >
          {icon}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-sm leading-relaxed font-semibold">
          {title}
        </h2>

        {description === undefined ? null : (
          <p className="text-muted-foreground truncate text-xs leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions === undefined ? null : (
        <div className="flex shrink-0 items-center gap-0.5">{actions}</div>
      )}
    </div>

    {children}
  </header>
);

export const EditorPanelBack = (): ReactElement => {
  const { setPanel } = useVisualEditor();
  const t = useTranslations("core.editor");

  return (
    <TooltipWithContent text={t("back_to_widgets")}>
      <Button
        aria-label={t("back_to_widgets")}
        className="-ms-2"
        onClick={setPanel}
        size="icon-sm"
        variant="ghost"
      >
        <ChevronLeftIcon className="rtl:rotate-180" />
      </Button>
    </TooltipWithContent>
  );
};

export const EditorPanelSeparator = (): ReactElement => (
  <span aria-hidden="true" className="bg-border mx-1 h-4 w-px" />
);
