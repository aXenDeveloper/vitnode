import { QueryClientContext } from "@tanstack/react-query";
import { useEditorState } from "@tiptap/react";
import { SparklesIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { QuickAskSnapshot } from "@/components/tiptap/quick-ask/quick-ask-editor";

import { useAvailableAiActions } from "@/components/ai/use-available-ai-actions";
import {
  useMultiLangLanguage,
  useMultiLangSelected,
} from "@/components/form/fields/multi-lang-language";
import {
  applyQuickAskResult,
  isQuickAskStale,
  takeQuickAskSnapshot,
} from "@/components/tiptap/quick-ask/quick-ask-editor";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { TooltipWithContent } from "@/components/ui/tooltip";
import { aiErrorCodeOf, sendAiFeedback } from "@/lib/ai/assist-client";
import {
  aiAssistScope,
  estimateAiAction,
  streamAiAction,
} from "@/lib/ai/stream-client";

import { useToolbarEditor } from "../use-toolbar-editor";

export const QUICK_ASK_REWRITE_ACTION =
  "@vitnode/core:editor.selection.rewrite";
export const QUICK_ASK_ACTION = "@vitnode/core:editor.quick-ask";

type Operation =
  | { instruction: string; kind: "custom" }
  | { kind: "continue" }
  | {
      kind: "rewrite";
      operation: "correct" | "shorten" | "simplify" | "tone";
      tone?: "confident" | "formal" | "friendly" | "neutral";
    };

type Phase =
  | { kind: "error"; message: string }
  | { kind: "idle" }
  | { kind: "result"; runId: number; text: string }
  | { kind: "streaming"; text: string };

const TONES = ["friendly", "formal", "confident", "neutral"] as const;

/**
 * Quick Ask: rewrite the selection, continue the text or follow a custom
 * request - streamed, previewed, then applied only when the writer chooses.
 * Applying is one editor transaction, so Undo restores the text.
 */
export const QuickAskAction = () => {
  const t = useTranslations("core.ai_assist.quick_ask");
  const tError = useTranslations("core.ai_assist.error");
  // The language of the text being edited - a multi-language field's tab -
  // and only then the interface language.
  const lockedLanguage = useMultiLangLanguage();
  const selectedLanguage = useMultiLangSelected();
  const contentLanguage = lockedLanguage ?? selectedLanguage;
  const interfaceLocale = useLocale();
  const locale = contentLanguage ?? interfaceLocale;
  const { editor } = useToolbarEditor();
  const scope = aiAssistScope();
  const { data: available = [] } = useAvailableAiActions(scope);
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>({ kind: "idle" });
  const [instruction, setInstruction] = React.useState("");
  const [estimate, setEstimate] = React.useState<null | string>(null);
  const [snapshot, setSnapshot] = React.useState<null | QuickAskSnapshot>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  // Re-evaluated on every editor change while a result waits for a decision.
  const stale = useEditorState({
    editor,
    selector: ctx =>
      phase.kind === "result" && snapshot
        ? isQuickAskStale(ctx.editor, snapshot)
        : false,
  });

  const canRewrite = available.includes(QUICK_ASK_REWRITE_ACTION);
  const canAsk = available.includes(QUICK_ASK_ACTION);
  if (!canRewrite && !canAsk) return null;

  const hasSelection = !editor.state.selection.empty;

  const inputFor = (operation: Operation, snapshot: QuickAskSnapshot) => {
    const context = {
      after: snapshot.after,
      before: snapshot.before,
      locale,
      selection: snapshot.selection,
    };
    if (operation.kind === "rewrite") {
      return {
        action: QUICK_ASK_REWRITE_ACTION,
        input: {
          ...context,
          operation: operation.operation,
          tone: operation.tone,
        },
      };
    }

    return {
      action: QUICK_ASK_ACTION,
      input: {
        ...context,
        instruction:
          operation.kind === "custom" ? operation.instruction : undefined,
        mode: operation.kind,
      },
    };
  };

  const onOpenChange = (next: boolean) => {
    if (!next) {
      abortRef.current?.abort();
      if (phase.kind === "result") {
        void sendAiFeedback({ accepted: false, runId: phase.runId, scope });
      }
      setPhase({ kind: "idle" });
      setOpen(false);

      return;
    }
    const taken = takeQuickAskSnapshot(editor);
    setSnapshot(taken);
    setOpen(true);
    setEstimate(null);
    if (canRewrite && taken.selection) {
      // A bound for one request, shown before anything runs.
      void estimateAiAction({
        ...inputFor({ kind: "rewrite", operation: "shorten" }, taken),
        scope,
      }).then(setEstimate);
    }
  };

  const run = async (operation: Operation) => {
    const source = snapshot ?? takeQuickAskSnapshot(editor);
    setSnapshot(source);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setPhase({ kind: "streaming", text: "" });
    let text = "";
    try {
      const summary = await streamAiAction({
        ...inputFor(operation, source),
        onDelta: delta => {
          text += delta;
          setPhase({ kind: "streaming", text });
        },
        scope,
        signal: abort.signal,
      });
      setPhase({ kind: "result", runId: summary.runId, text: text.trim() });
    } catch (error) {
      if (abort.signal.aborted) {
        setPhase({ kind: "idle" });

        return;
      }
      setPhase({ kind: "error", message: tError(aiErrorCodeOf(error)) });
    }
  };

  const apply = (mode: "below" | "replace") => {
    if (phase.kind !== "result" || !snapshot) return;
    const applied = applyQuickAskResult(editor, {
      from: snapshot.from,
      mode,
      text: phase.text,
      to: snapshot.to,
    });
    if (!applied) return;
    void sendAiFeedback({ accepted: true, runId: phase.runId, scope });
    setPhase({ kind: "idle" });
    setOpen(false);
    toast.success(t("applied.title"), {
      action: {
        label: t("applied.undo"),
        onClick: () => {
          editor.commands.undo();
        },
      },
      description: t("applied.desc"),
    });
  };

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <TooltipWithContent text={t("label")}>
        <PopoverTrigger
          render={
            <Toggle aria-label={t("label")} className="size-8" size="sm" />
          }
        >
          <SparklesIcon />
        </PopoverTrigger>
      </TooltipWithContent>

      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <QuickAskPanel
          canAsk={canAsk}
          canRewrite={canRewrite && hasSelection}
          estimate={estimate}
          instruction={instruction}
          onApply={apply}
          onDiscard={() => {
            onOpenChange(false);
          }}
          onInstruction={setInstruction}
          onRun={operation => void run(operation)}
          onStop={() => {
            abortRef.current?.abort();
          }}
          phase={phase}
          stale={stale}
        />
      </PopoverContent>
    </Popover>
  );
};

/**
 * Quick Ask needs the app's query client to learn which AI actions the
 * person may use; an editor rendered without one simply has no AI button.
 */
export const QuickAskSlot = () =>
  React.use(QueryClientContext) ? <QuickAskAction /> : null;

/** The panel's content for each phase - separate so it can be tested by DOM. */
export const QuickAskPanel = ({
  canAsk,
  canRewrite,
  estimate,
  instruction,
  onApply,
  onDiscard,
  onInstruction,
  onRun,
  onStop,
  phase,
  stale,
}: {
  canAsk: boolean;
  canRewrite: boolean;
  estimate: null | string;
  instruction: string;
  onApply: (mode: "below" | "replace") => void;
  onDiscard: () => void;
  onInstruction: (value: string) => void;
  onRun: (operation: Operation) => void;
  onStop: () => void;
  phase: Phase;
  stale: boolean;
}) => {
  const t = useTranslations("core.ai_assist.quick_ask");
  const instructionId = React.useId();

  if (phase.kind === "streaming") {
    return (
      <div className="flex flex-col gap-3">
        <p
          aria-live="polite"
          className="bg-muted text-foreground min-h-16 rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap"
        >
          {phase.text || (
            <span className="text-muted-foreground flex items-center gap-2">
              <Spinner /> {t("writing")}
            </span>
          )}
        </p>
        <Button onClick={onStop} size="sm" type="button" variant="outline">
          {t("stop")}
        </Button>
      </div>
    );
  }

  if (phase.kind === "result") {
    return (
      <div className="flex flex-col gap-3">
        <p className="bg-muted text-foreground rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap">
          {phase.text}
        </p>
        {stale ? (
          <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
            {t("stale")}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onDiscard} size="sm" type="button" variant="ghost">
            {t("discard")}
          </Button>
          <Button
            onClick={() => {
              onApply("below");
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("insert_below")}
          </Button>
          <Button
            disabled={stale || !canRewrite}
            onClick={() => {
              onApply("replace");
            }}
            size="sm"
            type="button"
          >
            {t("replace")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {phase.kind === "error" ? (
        <p className="text-destructive text-sm leading-relaxed" role="alert">
          {phase.message}
        </p>
      ) : null}

      {canRewrite ? (
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-2 gap-1">
            {(["shorten", "correct", "simplify"] as const).map(operation => (
              <Button
                key={operation}
                onClick={() => {
                  onRun({ kind: "rewrite", operation });
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                {t(`operation.${operation}`)}
              </Button>
            ))}
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("tone")}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {TONES.map(tone => (
              <Button
                key={tone}
                onClick={() => {
                  onRun({ kind: "rewrite", operation: "tone", tone });
                }}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t(`tones.${tone}`)}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("select_text")}
        </p>
      )}

      {canAsk ? (
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              onRun({ kind: "continue" });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("operation.continue")}
          </Button>
          <label className="text-sm font-medium" htmlFor={instructionId}>
            {t("custom_label")}
          </label>
          <Textarea
            id={instructionId}
            maxLength={500}
            onChange={event => {
              onInstruction(event.target.value);
            }}
            placeholder={t("custom_placeholder")}
            rows={2}
            value={instruction}
          />
          <Button
            disabled={!instruction.trim()}
            onClick={() => {
              onRun({ instruction: instruction.trim(), kind: "custom" });
            }}
            size="sm"
            type="button"
          >
            {t("ask")}
          </Button>
        </div>
      ) : null}

      {estimate ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("estimate", { points: estimate })}
        </p>
      ) : null}
    </div>
  );
};
