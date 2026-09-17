import type { ReactElement, ReactNode } from "react";

import { useTranslations } from "use-intl";

const Placeholder = ({ children }: { children: ReactNode }): ReactElement => (
  <div className="border-destructive/60 bg-destructive/5 text-destructive flex flex-col gap-1 rounded-md border border-dashed p-4">
    {children}
  </div>
);

export const UnknownBlock = ({ type }: { type: string }): ReactElement => {
  const t = useTranslations("core.editor");

  return (
    <Placeholder>
      <p className="text-sm font-medium text-pretty">
        {t("block.unknown.title")}
      </p>
      <p className="text-xs leading-relaxed text-pretty">
        {t("block.unknown.description", { type })}
      </p>
    </Placeholder>
  );
};

export const InvalidBlock = ({
  detail,
  name,
}: {
  detail: string;
  name: string;
}): ReactElement => {
  const t = useTranslations("core.editor");

  return (
    <Placeholder>
      <p className="text-sm font-medium text-pretty">
        {t("block.invalid.title")}
      </p>
      <p className="text-xs leading-relaxed text-pretty">
        {t("block.invalid.description", { name })}
      </p>
      <p className="text-muted-foreground text-xs leading-relaxed text-pretty">
        {t("block.invalid.detail", { issue: detail })}
      </p>
    </Placeholder>
  );
};
