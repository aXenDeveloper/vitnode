import {
  type AnyFieldApi,
  type AnyFormState,
  useSelector,
} from "@tanstack/react-form";
import { cn } from "cn";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  PlusIcon,
  SaveIcon,
} from "lucide-react";
import { AnimatePresence, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import { areFieldErrorsRevealed, useFormApi } from "@/components/ui/form";
import { SlidingNumber } from "@/components/ui/sliding-number";
import { prefersReducedMotion } from "@/tanstack/reactions/reaction-flight";

import type { ReactionFormValues } from "./reaction-form";

import { hasReactionLook, reactionLookOf } from "./reaction-preview";

export const REACTION_STEPS = [
  { fields: ["source", "symbol", "image"], id: "look" },
  { fields: ["title", "code", "enabled"], id: "details" },
  { fields: ["points"], id: "reputation" },
  { fields: ["allRoles", "roles"], id: "permissions" },
] as const;

export type ReactionStepId = (typeof REACTION_STEPS)[number]["id"];

export type PickReactionStep = (id: ReactionStepId, instant: boolean) => void;

const EASE_OUT = [0.32, 0.72, 0, 1] as const;
const EASE_OUT_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";
const SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;
const PANEL_SHIFT = 12;
const DESKTOP_QUERY = "(min-width: 48rem)";
const ERROR_SHAKE = [0, -3, 3, -2, 0];

const stepIndex = (id: ReactionStepId) =>
  REACTION_STEPS.findIndex(step => step.id === id);

const isStepDone = (id: ReactionStepId, values: ReactionFormValues) => {
  if (id === "look") return hasReactionLook(values);
  if (id === "details") {
    return (
      values.code.trim() !== "" &&
      values.title.some(item => item.value.trim() !== "")
    );
  }
  if (id === "permissions") return values.allRoles || values.roles.length > 0;

  return true;
};

const invalidStepsOf = (state: AnyFormState): ReactionStepId[] =>
  REACTION_STEPS.filter(step =>
    step.fields.some(name => {
      const meta = state.fieldMeta[name] as
        | AnyFieldApi["state"]["meta"]
        | undefined;

      return (
        !!meta &&
        meta.errors.length > 0 &&
        areFieldErrorsRevealed("onTouched", meta, state.submissionAttempts)
      );
    }),
  ).map(step => step.id);

const useInvalidSteps = (): ReactionStepId[] => {
  const { form } = useFormApi();
  const key = useSelector(form.store, state => invalidStepsOf(state).join(","));

  return key ? (key.split(",") as ReactionStepId[]) : [];
};

export const useReactionSteps = (isEdit: boolean) => {
  const [step, setStep] = React.useState<{
    active: ReactionStepId;
    direction: number;
    instant: boolean;
  }>({ active: "look", direction: 0, instant: true });
  const [visited, setVisited] = React.useState<ReadonlySet<ReactionStepId>>(
    () => new Set(isEdit ? REACTION_STEPS.map(item => item.id) : ["look"]),
  );

  const pick: PickReactionStep = React.useCallback((id, instant) => {
    setStep(current =>
      current.active === id
        ? current
        : {
            active: id,
            direction: Math.sign(stepIndex(id) - stepIndex(current.active)),
            instant,
          },
    );
    setVisited(current =>
      current.has(id) ? current : new Set(current).add(id),
    );
  }, []);

  return { pick, step, visited };
};

const useStepSummary = (values: ReactionFormValues, title: string) => {
  const t = useTranslations("admin.reactions.form");

  return (id: ReactionStepId) => {
    if (id === "look") return t(`kind_${reactionLookOf(values).kind}`);
    if (id === "details") {
      return values.enabled ? title : t("summary.hidden", { title });
    }
    if (id === "reputation") {
      return t("summary.points", {
        points: values.points > 0 ? `+${values.points}` : String(values.points),
      });
    }

    return values.allRoles
      ? t("summary.all_roles")
      : t("summary.roles", { count: values.roles.length });
  };
};

type StepBadgeState = "active" | "done" | "error" | "todo";

const STEP_BADGE = {
  active: {
    className: "border-foreground text-foreground",
    label: "state_todo",
  },
  done: {
    className: "border-primary bg-primary text-primary-foreground",
    label: "state_done",
  },
  error: {
    className: "border-destructive bg-destructive text-white",
    label: "state_error",
  },
  todo: { className: "text-muted-foreground", label: "state_todo" },
} as const satisfies Record<
  StepBadgeState,
  { className: string; label: string }
>;

const NO_MOTION = { duration: 0 } as const;
const BADGE_GLYPH_HIDDEN = {
  filter: "blur(2px)",
  opacity: 0,
  scale: 0.5,
} as const;

const stepBadgeStateOf = ({
  done,
  hasError,
  isActive,
}: {
  done: boolean;
  hasError: boolean;
  isActive: boolean;
}): StepBadgeState => {
  if (hasError) return "error";
  if (done) return "done";

  return isActive ? "active" : "todo";
};

const StepBadge = ({
  index,
  state,
}: {
  index: number;
  state: StepBadgeState;
}) => {
  const t = useTranslations("admin.reactions.form.steps");
  const reduceMotion = useReducedMotion();
  const shake = state === "error" && !reduceMotion;
  const showCheck = state === "done";

  return (
    <m.span
      animate={{ x: shake ? ERROR_SHAKE : 0 }}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full border text-xs font-medium tabular-nums transition-[background-color,border-color,color] duration-200 ease-out motion-reduce:transition-none",
        STEP_BADGE[state].className,
      )}
      initial={false}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <m.span
          animate={{ filter: "blur(0px)", opacity: 1, scale: 1 }}
          className="flex items-center justify-center"
          exit={{
            ...BADGE_GLYPH_HIDDEN,
            transition: reduceMotion
              ? NO_MOTION
              : { duration: 0.12, ease: "easeIn" },
          }}
          initial={BADGE_GLYPH_HIDDEN}
          key={showCheck ? "done" : "number"}
          transition={
            reduceMotion ? NO_MOTION : { duration: 0.2, ease: EASE_OUT }
          }
        >
          {showCheck ? (
            <CheckIcon aria-hidden="true" className="size-3" />
          ) : (
            <span aria-hidden="true">{index + 1}</span>
          )}
        </m.span>
      </AnimatePresence>
      <span className="sr-only">{t(STEP_BADGE[state].label)}</span>
    </m.span>
  );
};

export const ReactionStepNav = ({
  active,
  onPick,
  title,
  values,
  visited,
}: {
  active: ReactionStepId;
  onPick: PickReactionStep;
  title: string;
  values: ReactionFormValues;
  visited: ReadonlySet<ReactionStepId>;
}) => {
  const t = useTranslations("admin.reactions.form");
  const invalid = useInvalidSteps();
  const summary = useStepSummary(values, title);
  const reduceMotion = useReducedMotion();
  const indicatorId = React.useId();
  const activeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (window.matchMedia(DESKTOP_QUERY).matches) return;
    activeRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [active]);

  return (
    <ol
      aria-label={t("steps.label")}
      className="no-scrollbar flex snap-x snap-mandatory scroll-px-2 gap-1 overflow-x-auto overscroll-x-contain md:flex-col md:overflow-visible"
    >
      {REACTION_STEPS.map((step, index) => {
        const isActive = step.id === active;

        return (
          <li className="shrink-0 snap-start" key={step.id}>
            <button
              aria-current={isActive ? "step" : undefined}
              className={cn(
                "relative isolate flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2 text-start transition-[background-color,scale] duration-150 ease-out select-none active:scale-[0.96] md:items-start",
                "focus-visible:ring-ring/50 outline-none focus-visible:ring-3",
                !isActive && "hover:bg-background/60",
              )}
              onClick={event => {
                onPick(step.id, event.detail === 0);
              }}
              ref={isActive ? activeRef : undefined}
              type="button"
            >
              {isActive ? (
                <m.span
                  aria-hidden="true"
                  className="bg-background pointer-events-none absolute inset-0 -z-10 rounded-[inherit] shadow-xs ring-1 ring-black/5 dark:ring-white/10"
                  layoutId={indicatorId}
                  transition={reduceMotion ? { duration: 0 } : SPRING}
                />
              ) : null}
              <span className="md:mt-0.5">
                <StepBadge
                  index={index}
                  state={stepBadgeStateOf({
                    done: visited.has(step.id) && isStepDone(step.id, values),
                    hasError: invalid.includes(step.id),
                    isActive,
                  })}
                />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {t(`sections.${step.id}`)}
                </span>
                <span className="text-muted-foreground hidden max-w-full truncate text-xs md:block">
                  {summary(step.id)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
};

export const ReactionStepPanel = ({
  children,
  direction,
  instant,
  isActive,
}: {
  children: React.ReactNode;
  direction: number;
  instant: boolean;
  isActive: boolean;
}) => {
  const ref = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    if (!isActive || instant || direction === 0) return;
    if (prefersReducedMotion()) return;
    const axis = window.matchMedia(DESKTOP_QUERY).matches ? "Y" : "X";
    ref.current?.animate(
      [
        {
          opacity: 0,
          transform: `translate${axis}(${direction * PANEL_SHIFT}px)`,
        },
        { opacity: 1, transform: `translate${axis}(0)` },
      ],
      { duration: 220, easing: EASE_OUT_CSS },
    );
  }, [direction, instant, isActive]);

  return (
    <section
      className="flex flex-col gap-5 p-4 md:p-6"
      data-reaction-step
      hidden={!isActive}
      ref={ref}
    >
      {children}
    </section>
  );
};

const FooterAction = ({ children }: { children: React.ReactNode }) => {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.96,
        transition: reduceMotion
          ? { duration: 0 }
          : { duration: 0.12, ease: "easeIn" },
      }}
      initial={{ opacity: 0, scale: 0.96 }}
      layout="position"
      transition={
        reduceMotion
          ? { duration: 0 }
          : { default: { duration: 0.18, ease: EASE_OUT }, layout: SPRING }
      }
    >
      {children}
    </m.div>
  );
};

export const ReactionStepFooter = ({
  active,
  isEdit,
  onPick,
}: {
  active: ReactionStepId;
  isEdit: boolean;
  onPick: PickReactionStep;
}) => {
  const t = useTranslations("admin.reactions.form");
  const tGlobal = useTranslations("core.global");
  const { form } = useFormApi();
  const isDirty = useSelector(form.store, state => !state.isDefaultValue);
  const isSubmitting = useSelector(form.store, state => state.isSubmitting);
  const reduceMotion = useReducedMotion();
  const index = stepIndex(active);
  const previous = REACTION_STEPS[index - 1];
  const next = REACTION_STEPS[index + 1];

  const submit = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    await form.handleSubmit({});
    const [firstInvalid] = invalidStepsOf(form.state);
    if (!firstInvalid) return;
    onPick(firstInvalid, false);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          '[data-reaction-step]:not([hidden]) [aria-invalid="true"]',
        )
        ?.focus();
    });
  };

  return (
    <div className="bg-popover flex items-center justify-between gap-3 border-t p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))]">
      <p
        aria-live="polite"
        className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm tabular-nums"
      >
        <span className="inline-flex items-center gap-1">
          {t.rich("steps.progress", {
            current: index + 1,
            number: () => <SlidingNumber value={index + 1} />,
            total: REACTION_STEPS.length,
          })}
        </span>
        <AnimatePresence initial={false}>
          {isDirty ? (
            <m.span
              animate={{ opacity: 1 }}
              className="hidden truncate sm:inline"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            >
              · {tGlobal("unsaved_changes")}
            </m.span>
          ) : null}
        </AnimatePresence>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <DialogClose
          render={
            <Button className="hidden sm:inline-flex" variant="ghost">
              {tGlobal("cancel")}
            </Button>
          }
        />
        <AnimatePresence initial={false} mode="popLayout">
          {previous ? (
            <FooterAction key="back">
              <Button
                onClick={event => {
                  onPick(previous.id, event.detail === 0);
                }}
                type="button"
                variant="outline"
              >
                <ArrowLeftIcon aria-hidden="true" />
                {t("steps.back")}
              </Button>
            </FooterAction>
          ) : null}
          {next ? (
            <FooterAction key="next">
              <Button
                onClick={event => {
                  onPick(next.id, event.detail === 0);
                }}
                type="button"
              >
                <ArrowRightIcon aria-hidden="true" />
                {tGlobal("next")}
              </Button>
            </FooterAction>
          ) : (
            <FooterAction key="save">
              <Button
                disabled={!isDirty}
                isLoading={isSubmitting}
                onClick={event => void submit(event)}
                type="submit"
              >
                {isEdit ? (
                  <SaveIcon aria-hidden="true" />
                ) : (
                  <PlusIcon aria-hidden="true" />
                )}
                {isEdit ? t("submit_edit") : t("submit_create")}
              </Button>
            </FooterAction>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
