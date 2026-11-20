import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { FEEDBACK_TONE_TEXT } from "@/components/ui/feedback-tone";
import { ShortNumber } from "@/components/ui/short-number";

import { RouteMessages } from "../i18n/route-messages";

const ReputationInner = ({
  className,
  value,
}: {
  className?: string;
  value: number;
}) => {
  const t = useTranslations("core.reactions.reputation");

  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium",
        value > 0 && [
          FEEDBACK_TONE_TEXT.success,
          "bg-success/10 dark:bg-success/20",
        ],
        value < 0 && [
          FEEDBACK_TONE_TEXT.destructive,
          "bg-destructive/10 dark:bg-destructive/20",
        ],
        value === 0 && "bg-muted text-muted-foreground",
        className,
      )}
    >
      <ShortNumber
        className="font-semibold"
        formatOptions={{ signDisplay: "exceptZero" }}
        value={value}
      />
      <span className="opacity-80">{t("unit")}</span>
    </span>
  );
};

/**
 * A member's reputation as a tinted pill, such as "+1.2K reputation": green
 * above zero, red below, gray at zero, with the sign spelled out so color is
 * never the only signal. Large values are shortened, with the full number in a
 * tooltip. Loads its own messages. Universal.
 */
export const Reputation = (props: { className?: string; value: number }) => (
  <React.Suspense fallback={null}>
    <RouteMessages namespaces={["core.reactions"]}>
      <ReputationInner {...props} />
    </RouteMessages>
  </React.Suspense>
);
