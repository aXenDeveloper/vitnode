import { cn } from "cn";
import { CircleQuestionMarkIcon } from "lucide-react";
import { useId } from "react";
import { useTranslations } from "use-intl";

import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";

const TIP_OPEN_DELAY = 200;
const TIP_CLOSE_DELAY = 100;

/** `data-slot` of the {@link AutoFormTip} button, so form focus logic can skip it. */
export const AUTO_FORM_TIP_SLOT = "auto-form-tip";

/** Whether `tip` has something to show - `null`, `false` and blank strings do not. */
export const hasTipContent = (tip: React.ReactNode): boolean => {
  if (tip === null || tip === undefined || typeof tip === "boolean") {
    return false;
  }

  return typeof tip !== "string" || tip.trim() !== "";
};

/**
 * A small question-mark button that opens extra help about a form field in a
 * popover - on hover (after 200ms), click, tap, or Enter/Space; Escape or a
 * click outside closes it. Renders nothing when `children` is empty.
 *
 * Built-in `AutoForm` fields render it beside the label from their `tip` prop;
 * use it directly only in a custom label.
 */
export const AutoFormTip = ({
  children,
  className,
  labelId,
}: {
  /** The help content. Translate it in the UI language before passing it. */
  children?: React.ReactNode;
  className?: string;
  /** Id of the field's label, appended to the button's accessible name, e.g. "More information Title". */
  labelId?: string;
}) => {
  const t = useTranslations("core.global");
  const id = useId();

  if (!hasTipContent(children)) return null;

  return (
    <Popover>
      <PopoverTrigger
        aria-labelledby={labelId ? `${id} ${labelId}` : undefined}
        className={cn(
          "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 data-popup-open:text-foreground relative inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-colors outline-none after:absolute after:-inset-2 focus-visible:ring-3 motion-reduce:transition-none",
          className,
        )}
        closeDelay={TIP_CLOSE_DELAY}
        data-slot={AUTO_FORM_TIP_SLOT}
        delay={TIP_OPEN_DELAY}
        id={id}
        openOnHover
        type="button"
      >
        <CircleQuestionMarkIcon aria-hidden className="size-4" />
        <span className="sr-only">{t("field_tip")}</span>
      </PopoverTrigger>

      <PopoverContent
        className="w-max max-w-[min(--spacing(72),var(--available-width))] gap-2 p-3 leading-relaxed text-pretty wrap-break-word"
        side="top"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};
