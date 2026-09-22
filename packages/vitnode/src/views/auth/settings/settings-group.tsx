import { cn } from "cn";

export const SETTINGS_ROW =
  "flex min-h-12 w-full items-center gap-3 px-4 py-3 text-start outline-none";

export const SETTINGS_INTERACTIVE_ROW = cn(
  SETTINGS_ROW,
  "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-ring/50 transition-colors focus-visible:ring-3 focus-visible:ring-inset",
);

export const SETTINGS_ROW_LABEL =
  "text-foreground w-28 shrink-0 text-sm font-medium sm:w-36";

export const SettingsGroup = ({
  children,
  footer,
  title,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  title?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2">
    {title ? (
      <h3 className="text-muted-foreground px-4 text-sm font-medium">
        {title}
      </h3>
    ) : null}
    <ul className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl shadow-xs ring-1">
      {children}
    </ul>
    {footer ? (
      <p className="text-muted-foreground px-4 text-sm leading-relaxed text-pretty">
        {footer}
      </p>
    ) : null}
  </div>
);
