import type { AutoTranslateResponse } from "@vitnode/api/content/auto-translate";

import { cn } from "cn";
import { LanguagesIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";

import type { AutoTranslation } from "./use-auto-translation";

import { useLocale } from "../i18n/locale";
import { RouteMessages } from "../i18n/route-messages";
import { useAutoTranslateContext } from "./scope";

/** Message namespaces the translation controls render with. */
export const AUTO_TRANSLATE_NAMESPACES = [
  "core.global",
  "core.auto_translate",
] as const;

const languageNameOf = (code: null | string, locale: string) => {
  if (!code) return null;
  try {
    return (
      new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code
    );
  } catch {
    return code;
  }
};

const firstReason = (response: AutoTranslateResponse | null) =>
  response?.items[0]?.fields.find(field => field.state !== "ready");

const AutoTranslateNoteInner = ({
  className,
  translation,
}: {
  className?: string;
  translation: AutoTranslation<Record<string, unknown>>;
}) => {
  const t = useTranslations("core.auto_translate");
  const locale = useLocale();
  const [isTranslating, setIsTranslating] = React.useState(false);
  const language = languageNameOf(translation.sourceLocale, locale);

  if (translation.isTranslated) {
    return (
      <p
        className={cn(
          "text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-relaxed",
          className,
        )}
      >
        <LanguagesIcon aria-hidden="true" className="size-4" />
        <span>
          {language
            ? t(translation.automatic ? "automatic_from" : "translated_from", {
                language,
              })
            : t(translation.automatic ? "automatic" : "translated")}
        </span>
        <span aria-hidden="true">·</span>
        <button
          className="text-foreground underline-offset-4 hover:underline"
          onClick={translation.showOriginal}
          type="button"
        >
          {t("show_original")}
        </button>
      </p>
    );
  }

  if (translation.canShowTranslation) {
    return (
      <Button
        className={cn("self-start", className)}
        onClick={translation.showTranslation}
        size="sm"
        variant="ghost"
      >
        <LanguagesIcon aria-hidden="true" />
        {t("show_translation")}
      </Button>
    );
  }

  const pending =
    isTranslating || (translation.isPending && !translation.automatic);
  if (!translation.canTranslate && !pending) return null;

  return (
    <Button
      className={cn("text-muted-foreground self-start", className)}
      isLoading={pending}
      onClick={async () => {
        setIsTranslating(true);
        try {
          const response = await translation.translate();
          const problem = firstReason(response);
          if (!problem || problem.state === "pending") return;
          if (problem.state === "original") {
            toast.info(t("errors.original.title"), {
              description: t("errors.original.desc"),
            });
          } else if (problem.reason === "sign_in") {
            toast.info(t("errors.sign_in.title"), {
              description: t("errors.sign_in.desc"),
            });
          } else if (
            problem.reason === "budget" ||
            problem.reason === "limited" ||
            problem.reason === "disabled"
          ) {
            toast.error(t("errors.unavailable.title"), {
              description: t("errors.unavailable.desc"),
            });
          } else {
            toast.error(t("errors.skipped.title"), {
              description: t("errors.skipped.desc"),
            });
          }
        } finally {
          setIsTranslating(false);
        }
      }}
      size="sm"
      variant="ghost"
    >
      <LanguagesIcon aria-hidden="true" />
      {pending ? t("translating") : t("translate")}
    </Button>
  );
};

/**
 * The line under a translated record - "Automatically translated from
 * English · Show original" - or its Translate / Show translation action.
 * Renders nothing when the site has automatic translation off.
 */
export const AutoTranslateNote = (props: {
  className?: string;
  translation: AutoTranslation<Record<string, unknown>>;
}) => {
  const context = useAutoTranslateContext();
  if (!context?.settings.enabled) return null;

  return (
    <React.Suspense fallback={null}>
      <RouteMessages namespaces={AUTO_TRANSLATE_NAMESPACES}>
        <AutoTranslateNoteInner {...props} />
      </RouteMessages>
    </React.Suspense>
  );
};
