import type { VariantProps } from "class-variance-authority";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "cn";
import { CopyIcon } from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { MotionFeatures } from "@/components/motion-features";

import { buttonVariants } from "./button";

const checkPath = "M4 12l5 5 11-11";

type CopyButtonProps = Omit<
  ButtonPrimitive.Props,
  "children" | "className" | "content"
> &
  VariantProps<typeof buttonVariants> & {
    children?: React.ReactNode;
    className?: string;
    content: (() => Promise<string> | string) | string;
    copied?: boolean;
    delay?: number;
    onCopiedChange?: (copied: boolean) => void;
  };

const useIconMotion = () => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      transition: { duration: 0.15 },
      check: { initial: { pathLength: 1 }, transition: { duration: 0 } },
    };
  }

  return {
    hidden: { opacity: 0, scale: 0.4, filter: "blur(4px)" },
    visible: { opacity: 1, scale: 1, filter: "blur(0px)" },
    transition: { type: "spring", duration: 0.3, bounce: 0 } as const,
    check: {
      initial: { pathLength: 0 },
      transition: {
        type: "spring",
        duration: 0.35,
        bounce: 0,
        delay: 0.05,
      } as const,
    },
  };
};

const writeToClipboard = async (content: CopyButtonProps["content"]) => {
  if (typeof content === "string") {
    await navigator.clipboard.writeText(content);

    return;
  }

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
    await navigator.clipboard.writeText(await content());

    return;
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "text/plain": Promise.resolve()
        .then(content)
        .then(text => new Blob([text], { type: "text/plain" })),
    }),
  ]);
};

const CopiedCheck = ({
  initial,
  transition,
}: Pick<React.ComponentProps<typeof m.path>, "initial" | "transition">) => (
  <svg
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
  >
    <m.path
      animate={{ pathLength: 1 }}
      d={checkPath}
      initial={initial}
      transition={transition}
    />
  </svg>
);

function CopyButton({
  "aria-label": ariaLabel,
  children,
  className,
  content,
  copied,
  delay = 2000,
  onClick,
  onCopiedChange,
  size,
  variant = "outline",
  ...props
}: CopyButtonProps) {
  const t = useTranslations("core.global");
  const [uncontrolledCopied, setUncontrolledCopied] = React.useState(false);
  const [copyCount, setCopyCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const isCopied = copied ?? uncontrolledCopied;
  const iconMotion = useIconMotion();

  const setCopied = (next: boolean) => {
    setUncontrolledCopied(next);
    onCopiedChange?.(next);
  };

  const resetCopied = React.useEffectEvent(() => {
    setCopied(false);
  });

  React.useEffect(() => {
    if (!isCopied) return;

    const timer = setTimeout(resetCopied, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [isCopied, delay, copyCount]);

  const copyToClipboard = async () => {
    if (isLoading) return;
    setIsLoading(typeof content !== "string");

    try {
      await writeToClipboard(content);
      setCopied(true);
      setCopyCount(count => count + 1);
    } catch {
      toast.error(t("errors.title"), { description: t("copy_failed") });
    } finally {
      setIsLoading(false);
    }
  };

  const hasLabel = children !== undefined && children !== null;
  const stateLabel = isCopied ? t("copied") : t("copy");

  return (
    <MotionFeatures>
      <ButtonPrimitive
        aria-busy={isLoading || undefined}
        aria-label={ariaLabel ?? (hasLabel ? undefined : stateLabel)}
        className={cn(
          buttonVariants({
            variant,
            size: size ?? (hasLabel ? "default" : "icon"),
          }),
          "relative",
          className,
        )}
        data-copied={isCopied ? "" : undefined}
        data-slot="copy-button"
        onClick={event => {
          onClick?.(event);
          if (event.defaultPrevented) return;

          void copyToClipboard();
        }}
        type="button"
        {...props}
      >
        <AnimatePresence initial={false} mode="popLayout">
          <m.span
            animate={iconMotion.visible}
            className="flex items-center justify-center"
            data-icon={hasLabel ? "inline-start" : undefined}
            data-slot="copy-button-icon"
            exit={iconMotion.hidden}
            initial={iconMotion.hidden}
            key={isCopied ? "check" : "copy"}
            transition={iconMotion.transition}
          >
            {isCopied ? (
              <CopiedCheck {...iconMotion.check} />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
          </m.span>
        </AnimatePresence>
        {children}
      </ButtonPrimitive>
      <span aria-live="polite" className="sr-only" role="status">
        {isCopied ? t("copied") : ""}
      </span>
    </MotionFeatures>
  );
}

export { CopyButton, type CopyButtonProps };
