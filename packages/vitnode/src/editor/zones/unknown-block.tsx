import type { ReactElement } from "react";

import { useTranslations } from "use-intl";

export const UnknownBlock = ({ type }: { type: string }): ReactElement => {
  const t = useTranslations("core.editor");

  return (
    <div className="border-destructive/60 bg-destructive/5 text-destructive flex flex-col gap-1 rounded-md border border-dashed p-4">
      <p className="text-sm font-medium text-pretty">
        {t("block.unknown.title")}
      </p>
      <p className="text-xs leading-relaxed text-pretty">
        {t("block.unknown.description", { type })}
      </p>
    </div>
  );
};
