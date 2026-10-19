import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";

import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { MotionFeatures } from "@/components/motion-features";
import { Button } from "@/components/ui/button";
import { DialogTitle, useDialog } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { MODERATION_LIMITS } from "@/lib/moderation/const";

import type { ModerationFailure } from "../moderation-mutations";
import type { ReportReasonOption } from "../report-reasons-query";

import { createReport } from "../moderation-mutations";
import {
  REPORT_REASONS_QUERY_KEY,
  reportReasonsQueryOptions,
  resolveReasonText,
} from "../report-reasons-query";

export interface ReportPreview {
  imageUrl?: null | string;
  meta?: null | string;
  title: string;
}

export interface ReportDialogContentProps {
  locale: null | string;
  onClose: () => void;
  pluginId: string;
  preview?: ReportPreview;
  requestedLocale: null | string;
  targetId: string;
  targetType: string;
  typeLabel: string;
}

type Step = "reason" | "review" | "sent";

const STEP_ORDER: Record<Step, number> = { reason: 0, review: 1, sent: 2 };
const EASE_OUT = [0.32, 0.72, 0, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const ENTER_S = 0.26;
const EXIT_S = 0.14;
const SLIDE_PX = 16;
const ADVANCE_DELAY_MS = 180;
const HEIGHT_SPRING = { type: "spring", duration: 0.36, bounce: 0 } as const;
const COUNTER_FROM = MODERATION_LIMITS.descriptionMaxLength - 200;
const NAVIGATION_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Home",
]);

const slide = {
  enter: (direction: number) => ({
    opacity: 0,
    transform: `translateX(${direction * SLIDE_PX}px)`,
  }),
  center: {
    opacity: 1,
    transform: "translateX(0px)",
    transition: { delay: EXIT_S * 0.75, duration: ENTER_S, ease: EASE_OUT },
  },
  exit: (direction: number) => ({
    opacity: 0,
    transform: `translateX(${direction * -SLIDE_PX * 0.5}px)`,
    transition: { duration: EXIT_S, ease: EASE_IN },
  }),
};

const fade = {
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.1 } },
  initial: { opacity: 0 },
  transition: { delay: 0.06, duration: 0.2 },
};

const isTouchDevice = () => window.matchMedia("(pointer: coarse)").matches;

const useElementHeight = () => {
  const [height, setHeight] = React.useState<"auto" | number>("auto");

  const ref = React.useCallback((element: HTMLDivElement) => {
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.borderBoxSize[0].blockSize);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, height] as const;
};

const subscribeToResize = (onChange: () => void) => {
  window.addEventListener("resize", onChange);

  return () => {
    window.removeEventListener("resize", onChange);
  };
};

const readViewportCap = () =>
  window.innerHeight -
  (window.matchMedia("(min-width: 40rem)").matches ? 80 : 32);

const readServerViewportCap = () => undefined;

const useViewportCap = () =>
  React.useSyncExternalStore(
    subscribeToResize,
    readViewportCap,
    readServerViewportCap,
  );

const ReceiptRow = ({ children }: { children: React.ReactNode }) => (
  <m.div className="border-popover border-t-2 p-3 first:border-t-0" {...fade}>
    {children}
  </m.div>
);

const ReasonSkeleton = () => (
  <div aria-hidden className="flex flex-col gap-2">
    {[0, 1, 2].map(row => (
      <Skeleton className="h-16 w-full rounded-lg" key={row} />
    ))}
  </div>
);

const ReasonList = ({
  onPick,
  reasonCode,
  reasons,
  setReasonCode,
}: {
  onPick: (code: string) => void;
  reasonCode: string | undefined;
  reasons: ReportReasonOption[];
  setReasonCode: (code: string) => void;
}) => {
  const t = useTranslations("core.moderation.report");
  const locale = useLocale();
  const navigatingRef = React.useRef(false);

  return (
    <RadioGroup
      aria-label={t("reasons_label")}
      className="gap-2"
      onKeyDown={event => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const code = (event.target as HTMLElement).dataset.reason;
        if (!code) return;
        event.preventDefault();
        onPick(code);
      }}
      onKeyDownCapture={event => {
        if (!NAVIGATION_KEYS.has(event.key)) return;
        navigatingRef.current = true;
        requestAnimationFrame(() => {
          navigatingRef.current = false;
        });
      }}
      onValueChange={value => {
        if (navigatingRef.current) {
          setReasonCode(String(value));

          return;
        }
        onPick(String(value));
      }}
      value={reasonCode ?? null}
    >
      {reasons.map(reason => {
        const id = `report-reason-${reason.code}`;
        const description = resolveReasonText(reason.description, locale);

        return (
          <label
            className="hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5 flex cursor-pointer touch-manipulation items-start gap-3 rounded-lg border px-3 py-3 transition-[background-color,border-color] duration-150 ease-out motion-reduce:transition-none"
            htmlFor={id}
            key={reason.code}
            onClick={event => {
              if (reason.code === reasonCode && event.detail > 0) {
                onPick(reason.code);
              }
            }}
          >
            <RadioGroupItem
              className="mt-0.5"
              data-reason={reason.code}
              id={id}
              value={reason.code}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm leading-snug font-medium text-pretty">
                {resolveReasonText(reason.title, locale)}
              </span>
              {description ? (
                <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </RadioGroup>
  );
};

const CharactersLeft = ({ value }: { value: unknown }) => {
  const t = useTranslations("core.moderation.report");
  const length = typeof value === "string" ? value.length : 0;
  if (length < COUNTER_FROM) return null;

  return (
    <span
      aria-live="polite"
      className="text-muted-foreground text-xs tabular-nums"
    >
      {t("chars_left", {
        count: MODERATION_LIMITS.descriptionMaxLength - length,
      })}
    </span>
  );
};

const toastedFailureKey = (failure: ModerationFailure) =>
  failure === "details_required" ||
  failure === "duplicate" ||
  failure === "not_found" ||
  failure === "rate_limited" ||
  failure === "reason_not_found" ||
  failure === "unauthenticated" ||
  failure === "validation"
    ? failure
    : "unknown";

const ReportReceipt = ({
  onChangeReason,
  preview,
  reason,
  step,
}: {
  onChangeReason: () => void;
  preview?: ReportPreview;
  reason: ReportReasonOption | undefined;
  step: Step;
}) => {
  const t = useTranslations("core.moderation.report");
  const locale = useLocale();

  return (
    <div className="bg-muted/50 flex flex-col rounded-lg">
      {preview ? (
        <div className="flex items-center gap-3 p-3">
          {preview.imageUrl ? (
            <img
              alt=""
              className="bg-muted aspect-video w-16 shrink-0 rounded-sm object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
              decoding="async"
              height={36}
              src={preview.imageUrl}
              width={64}
            />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span className="line-clamp-2 text-sm leading-snug font-medium">
              {preview.title}
            </span>
            {preview.meta ? (
              <span className="text-muted-foreground truncate text-sm">
                {preview.meta}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {reason && step !== "reason" ? (
          <ReceiptRow key="reason">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm leading-snug font-medium text-pretty">
                  {resolveReasonText(reason.title, locale)}
                </span>
                <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
                  {resolveReasonText(reason.description, locale)}
                </span>
              </div>
              {step === "review" ? (
                <Button
                  aria-label={t("change_label", {
                    reason: resolveReasonText(reason.title, locale),
                  })}
                  className="-my-1 -me-1"
                  onClick={onChangeReason}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  {t("change")}
                </Button>
              ) : null}
            </div>
          </ReceiptRow>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {step === "sent" ? (
          <ReceiptRow key="sent">
            <p className="text-success text-sm font-medium">
              {t("sent_stamp")}
            </p>
          </ReceiptRow>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const ReasonStep = (
  props: Omit<React.ComponentProps<typeof ReasonList>, "reasons">,
) => {
  const t = useTranslations("core.moderation.report");
  const reasonsQuery = useQuery(reportReasonsQueryOptions());

  if (reasonsQuery.data) {
    return <ReasonList {...props} reasons={reasonsQuery.data} />;
  }
  if (!reasonsQuery.isError) return <ReasonSkeleton />;

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {t("load_error")}
      </p>
      <Button
        onClick={async () => {
          await reasonsQuery.refetch();
        }}
        size="sm"
        variant="outline"
      >
        {t("retry")}
      </Button>
    </div>
  );
};

const DetailsStep = ({
  onSubmit,
  reason,
}: {
  onSubmit: (description: null | string) => Promise<void>;
  reason: ReportReasonOption;
}) => {
  const t = useTranslations("core.moderation.report");
  const formSchema = z.object({
    description: reason.requiresDetails
      ? z
          .string()
          .trim()
          .min(MODERATION_LIMITS.requiredDescriptionMinLength, {
            message: t("errors.details_required", {
              min: MODERATION_LIMITS.requiredDescriptionMinLength,
            }),
          })
          .max(MODERATION_LIMITS.descriptionMaxLength)
          .default("")
      : z
          .string()
          .trim()
          .max(MODERATION_LIMITS.descriptionMaxLength)
          .optional()
          .default(""),
  });

  const submit: AutoFormOnSubmit<typeof formSchema> = async values => {
    await onSubmit(values.description || null);
  };

  return (
    <AutoForm
      className="flex flex-col gap-5"
      fields={[
        {
          id: "description",
          component: props => (
            <AutoFormTextarea
              {...props}
              className="min-h-24"
              description={t("details_note")}
              label={
                reason.requiresDetails
                  ? t("details_required_label")
                  : t("details_optional_label")
              }
              labelRight={<CharactersLeft value={props.field.value} />}
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                reason.requiresDetails ? t("details_placeholder") : undefined
              }
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={rendered => (
        <>
          {rendered.description}
          <AutoFormSubmitButton className="w-full">
            {t("submit")}
          </AutoFormSubmitButton>
        </>
      )}
      onSubmit={submit}
    />
  );
};

const SentStep = ({
  onClose,
  typeLabel,
}: {
  onClose: () => void;
  typeLabel: string;
}) => {
  const t = useTranslations("core.moderation.report");

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
        {t("sent_desc", { type: typeLabel })}
      </p>
      <Button className="w-full" onClick={onClose} variant="outline">
        {t("done")}
      </Button>
    </div>
  );
};

export const ReportDialogContent = ({
  locale,
  onClose,
  pluginId,
  preview,
  requestedLocale,
  targetId,
  targetType,
  typeLabel,
}: ReportDialogContentProps) => {
  const t = useTranslations("core.moderation.report");
  const queryClient = useQueryClient();
  const { setIsDirty } = useDialog();
  const { data: reasons } = useQuery(reportReasonsQueryOptions());
  const [step, setStep] = React.useState<Step>("reason");
  const [direction, setDirection] = React.useState(1);
  const [reasonCode, setReasonCode] = React.useState<string>();
  const [trackRef, height] = useElementHeight();
  const viewportCap = useViewportCap();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const advanceTimerRef =
    React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const reason = reasons?.find(item => item.code === reasonCode);
  const visibleHeight =
    typeof height === "number" && viewportCap
      ? Math.min(height, viewportCap)
      : height;

  React.useEffect(
    () => () => {
      clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    if (step === "review" && !isTouchDevice()) {
      scrollRef.current?.querySelector("textarea")?.focus();
    } else {
      headingRef.current?.focus();
    }
  }, [step]);

  const goTo = (next: Step) => {
    setDirection(STEP_ORDER[next] > STEP_ORDER[step] ? 1 : -1);
    setStep(next);
  };

  const pick = (code: string) => {
    clearTimeout(advanceTimerRef.current);
    setReasonCode(code);
    advanceTimerRef.current = setTimeout(() => {
      goTo("review");
    }, ADVANCE_DELAY_MS);
  };

  const submit = async (
    pickedReason: ReportReasonOption,
    description: null | string,
  ) => {
    const result = await createReport({
      description,
      locale,
      pluginId,
      reason: pickedReason.code,
      requestedLocale,
      targetId,
      targetType,
    });

    if (result.ok) {
      setIsDirty?.(false);
      goTo("sent");

      return;
    }

    const key = toastedFailureKey(result.failure);
    toast.error(t("errors.title"), {
      description: t(`errors.${key}`, {
        min: MODERATION_LIMITS.requiredDescriptionMinLength,
      }),
    });
    if (key === "reason_not_found") {
      await queryClient.invalidateQueries({
        queryKey: REPORT_REASONS_QUERY_KEY,
      });
      setReasonCode(undefined);
      goTo("reason");
    }
    if (key === "duplicate" || key === "not_found") {
      setIsDirty?.(false);
      onClose();
    }
  };

  const titles: Record<Step, string> = {
    reason: t("pick_title", { type: typeLabel }),
    review: t("review_title"),
    sent: t("sent_title"),
  };

  return (
    <MotionConfig reducedMotion="user">
      <MotionFeatures>
        <m.div
          animate={{ height: visibleHeight }}
          className="overflow-x-hidden overflow-y-auto overscroll-contain"
          initial={false}
          ref={scrollRef}
          transition={HEIGHT_SPRING}
        >
          <div className="flex flex-col gap-5 p-6" ref={trackRef}>
            <DialogTitle
              className="pe-10 text-balance outline-none"
              ref={headingRef}
              tabIndex={-1}
            >
              <m.span
                animate={{ opacity: 1 }}
                className="block"
                initial={{ opacity: 0 }}
                key={step}
                transition={{ duration: 0.18 }}
              >
                {titles[step]}
              </m.span>
            </DialogTitle>

            {preview || step !== "reason" ? (
              <ReportReceipt
                onChangeReason={() => {
                  goTo("reason");
                }}
                preview={preview}
                reason={reason}
                step={step}
              />
            ) : null}

            <div className="relative">
              <AnimatePresence
                custom={direction}
                initial={false}
                mode="popLayout"
              >
                <m.div
                  animate="center"
                  className="w-full"
                  custom={direction}
                  exit="exit"
                  initial="enter"
                  key={step}
                  variants={slide}
                >
                  {step === "reason" ? (
                    <ReasonStep
                      onPick={pick}
                      reasonCode={reasonCode}
                      setReasonCode={setReasonCode}
                    />
                  ) : null}

                  {step === "review" && reason ? (
                    <DetailsStep
                      key={reason.code}
                      onSubmit={async description => {
                        await submit(reason, description);
                      }}
                      reason={reason}
                    />
                  ) : null}

                  {step === "sent" ? (
                    <SentStep onClose={onClose} typeLabel={typeLabel} />
                  ) : null}
                </m.div>
              </AnimatePresence>
            </div>
          </div>
        </m.div>
      </MotionFeatures>
    </MotionConfig>
  );
};

export default ReportDialogContent;
