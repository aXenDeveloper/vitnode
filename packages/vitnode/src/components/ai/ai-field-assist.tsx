import { useQuery } from "@tanstack/react-query";
import { SparklesIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import type { ContentFieldAiAssist } from "@/content/types";

import { useMultiLangSelected } from "@/components/form/fields/multi-lang-language";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { CONFIG_PLUGIN } from "@/config";
import {
  aiErrorCodeOf,
  requestAiAssist,
  sendAiFeedback,
} from "@/lib/ai/assist-client";
import {
  type AiFieldSuggestion,
  applyAiSuggestion,
  buildAiFieldInput,
  fieldTextOf,
  suggestionFreshness,
} from "@/lib/ai/suggestion";
import { fetcher } from "@/tanstack/fetcher";
import {
  useContentFormValues,
  useSetContentFormValue,
} from "@/views/admin/views/content/form/values";

/** The AI actions this admin may start; cached for the session. */
export const useAvailableAiActions = () =>
  useQuery({
    queryFn: async () => {
      const response = await fetcher({
        plugin: CONFIG_PLUGIN.pluginId,
        method: "get",
        module: "admin/ai",
        path: "/assist/available",
      });
      if (!response.ok) return [] as string[];

      return (await response.json()).actions;
    },
    queryKey: ["ai", "assist", "available"],
    staleTime: 5 * 60_000,
  });

/**
 * The AI button of a text field with `ai` assistance. It asks the field's
 * action for a suggestion from the source fields, in the language being
 * edited, and shows it for review: nothing reaches the field until the
 * editor accepts it, and saving goes through the normal form, validation and
 * revisions. Shown only when the server says this admin may use the action.
 */
export const AiFieldAssist = ({
  ai,
  fieldName,
  multiLang,
}: {
  ai: ContentFieldAiAssist;
  fieldName: string;
  multiLang: boolean;
}) => {
  const t = useTranslations("core.ai_assist");
  const locale = useLocale();
  const selected = useMultiLangSelected();
  const language = selected ?? locale;
  const values = useContentFormValues();
  const setValue = useSetContentFormValue();
  const { data: available = [] } = useAvailableAiActions();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<AiFieldSuggestion | null>(
    null,
  );
  const controllerRef = React.useRef<AbortController | null>(null);

  if (!available.includes(ai.action)) return null;

  const currentTarget = fieldTextOf(values[fieldName], language);
  const { input, sourceFingerprint } = buildAiFieldInput({
    language,
    sourceFields: ai.sourceFields,
    values,
  });
  const freshness = suggestion
    ? suggestionFreshness({
        currentSourceFingerprint: sourceFingerprint,
        currentTarget,
        suggestion,
      })
    : null;
  const missingSources = ai.sourceFields.filter(
    name => input[name].trim() === "",
  );

  const generate = async () => {
    controllerRef.current?.abort();
    const abort = new AbortController();
    controllerRef.current = abort;
    setPending(true);
    const snapshot = currentTarget;
    try {
      const result = await requestAiAssist({
        action: ai.action,
        input,
        signal: abort.signal,
        sourceFingerprint,
      });
      if (typeof result.output !== "string")
        throw new Error("AI_INVALID_OUTPUT");
      setSuggestion({
        language,
        runId: result.runId,
        sourceFingerprint,
        targetSnapshot: snapshot,
        text: result.output,
      });
    } catch (error) {
      if (abort.signal.aborted) return;
      toast.error(t("error.title"), {
        description: t(`error.${aiErrorCodeOf(error)}`),
      });
    } finally {
      if (controllerRef.current === abort) setPending(false);
    }
  };

  const close = (accepted: boolean | null) => {
    controllerRef.current?.abort();
    if (suggestion && accepted !== null) {
      void sendAiFeedback({ accepted, runId: suggestion.runId });
    }
    setSuggestion(null);
    setOpen(false);
  };

  const accept = () => {
    if (!suggestion) return;
    setValue(
      fieldName,
      applyAiSuggestion({
        language: suggestion.language,
        multiLang,
        text: suggestion.text,
        value: values[fieldName],
      }),
    );
    toast.success(t("accepted.title"), {
      description: t("accepted.desc"),
    });
    close(true);
  };

  return (
    <Popover
      onOpenChange={next => {
        if (!next) close(suggestion ? false : null);
        else setOpen(true);
      }}
      open={open}
    >
      <PopoverTrigger
        render={
          <Button
            aria-label={t("open", { field: fieldName })}
            size="xs"
            type="button"
            variant="ghost"
          />
        }
      >
        <SparklesIcon aria-hidden />
        <span>{t("button")}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-80 flex-col gap-3">
        <PopoverHeader>
          <PopoverTitle>{t("title")}</PopoverTitle>
          <PopoverDescription>
            {t("desc", { language: language.toUpperCase() })}
          </PopoverDescription>
        </PopoverHeader>

        <AiSuggestionBody
          missingSources={missingSources}
          onAccept={accept}
          onDiscard={() => {
            close(false);
          }}
          onGenerate={() => void generate()}
          pending={pending}
          staleSource={freshness?.staleSource ?? false}
          suggestion={suggestion?.text ?? null}
          targetEdited={freshness?.targetEdited ?? false}
        />
      </PopoverContent>
    </Popover>
  );
};

/** The review panel: suggestion, freshness warnings and the three choices. */
export const AiSuggestionBody = ({
  missingSources,
  onAccept,
  onDiscard,
  onGenerate,
  pending,
  staleSource,
  suggestion,
  targetEdited,
}: {
  missingSources: string[];
  onAccept: () => void;
  onDiscard: () => void;
  onGenerate: () => void;
  pending: boolean;
  staleSource: boolean;
  suggestion: null | string;
  targetEdited: boolean;
}) => {
  const t = useTranslations("core.ai_assist");

  return (
    <>
      {missingSources.length > 0 ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("missing_sources", { fields: missingSources.join(", ") })}
        </p>
      ) : null}

      <div aria-live="polite" className="flex flex-col gap-2">
        {pending ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner /> {t("generating")}
          </p>
        ) : null}
        {suggestion !== null && !pending ? (
          <>
            <p className="bg-muted text-foreground rounded-md p-3 text-sm leading-relaxed whitespace-pre-wrap">
              {suggestion}
            </p>
            {staleSource ? (
              <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                {t("stale_source")}
              </p>
            ) : null}
            {targetEdited ? (
              <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                {t("target_edited")}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {suggestion !== null && !pending ? (
          <>
            <Button onClick={onDiscard} size="sm" type="button" variant="ghost">
              {t("discard")}
            </Button>
            <Button
              onClick={onGenerate}
              size="sm"
              type="button"
              variant="outline"
            >
              {t("regenerate")}
            </Button>
            <Button onClick={onAccept} size="sm" type="button">
              {targetEdited ? t("replace_anyway") : t("accept")}
            </Button>
          </>
        ) : (
          <Button
            disabled={pending || missingSources.length > 0}
            onClick={onGenerate}
            size="sm"
            type="button"
          >
            {t("generate")}
          </Button>
        )}
      </div>
    </>
  );
};
