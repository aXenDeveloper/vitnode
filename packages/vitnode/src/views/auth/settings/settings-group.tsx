import { cn } from "cn";
import React from "react";

import {
  Frame,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/ui/frame";

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
}) => {
  const titleId = React.useId();

  return (
    <Frame
      aria-labelledby={title ? titleId : undefined}
      render={title ? <section /> : undefined}
    >
      {title ? (
        <FrameHeader>
          <FrameTitle
            className="flex items-center gap-2"
            id={titleId}
            render={<h2 />}
          >
            {title}
          </FrameTitle>
        </FrameHeader>
      ) : null}
      <FramePanel render={<ul />}>{children}</FramePanel>
      {footer ? <FrameFooter>{footer}</FrameFooter> : null}
    </Frame>
  );
};
