import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setFormFieldError } from "@/components/ui/form";
import { parseContentPublicWriteRejection } from "@/content/conflicts";
import {
  CONTENT_CONFLICT_CODES,
  CONTENT_PUBLIC_WRITE_ISSUE_CODES,
} from "@/content/const";

type FormApi = Parameters<typeof setFormFieldError>[0];

/** The response of a typed `fetcher` call to a public write route. */
interface WriteResponse {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
}

/** What a successful write answers with, read off the typed response. */
type WrittenRecord<R> = R extends { json: () => Promise<infer T>; ok: true }
  ? T
  : never;

const ISSUE_MESSAGES = {
  [CONTENT_PUBLIC_WRITE_ISSUE_CODES.editWindowClosed]: "edit_window_closed",
  [CONTENT_PUBLIC_WRITE_ISSUE_CODES.moderatorsOnly]: "moderators_only",
  [CONTENT_PUBLIC_WRITE_ISSUE_CODES.notWritable]: "not_writable",
  [CONTENT_PUBLIC_WRITE_ISSUE_CODES.unavailable]: "unavailable",
} as const;

const STATUS_MESSAGES = {
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  429: "rate_limited",
} as const;

const isKnownIssue = (code: string): code is keyof typeof ISSUE_MESSAGES =>
  code in ISSUE_MESSAGES;

const isKnownStatus = (
  status: number,
): status is keyof typeof STATUS_MESSAGES => status in STATUS_MESSAGES;

const versionOf = (record: unknown): number | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const { version } = record as { version?: unknown };

  return typeof version === "number" ? version : undefined;
};

/**
 * Sends one public create or edit and handles every answer that is not a
 * success, so a form's `onSubmit` only deals with the record it gets back:
 *
 * - `400`: each issue on a field in `fields` shows under that field; anything
 *   else, and every other refusal (`401`, `403`, `404`, `429`), is one toast.
 *   Messages come from `core.global.content_write` and follow the reader's
 *   language.
 * - `409 CONTENT_UNIQUE_CONFLICT` shows under `uniqueField`, or as a toast.
 * - `409 CONTENT_VERSION_CONFLICT` shows `conflict`: an alert that keeps the
 *   form as it is and offers "Keep my version" (with `latestVersion`) and
 *   "Load latest version", which reloads the page and drops unsaved input.
 *
 * For an edit, pass `version` and `latestVersion`, and send `expectedVersion`
 * from the `request` argument: the hook keeps it current after every save and
 * after "Keep my version". `version` is read once, so remount the form (with a
 * `key`) for another record.
 *
 * On success it only returns the record. Success messages, a pending
 * `approval`, `form.reset`, cache invalidation and navigation stay with the
 * caller. Browser-only.
 *
 * @example
 * ```tsx
 * import type { AutoFormOnSubmit } from "@vitnode/core/components/form/auto-form";
 *
 * import { useContentPublicWrite } from "@vitnode/core/tanstack/content";
 * import { fetcher } from "@vitnode/core/tanstack/fetcher";
 *
 * const write = useContentPublicWrite({
 *   fields: ["title", "body"],
 *   latestVersion: async () => {
 *     const res = await fetchEditable(record.id); // GET /{id}/edit
 *
 *     return res.status === 200 ? (await res.json()).version : null;
 *   },
 *   uniqueField: "title",
 *   version: record.version,
 * });
 *
 * const onSubmit: AutoFormOnSubmit<Schema> = async (values, form) => {
 *   const updated = await write.submit(form, async expectedVersion =>
 *     await fetcher({
 *       plugin: manifest.id,
 *       method: "patch",
 *       module: "content/discussions",
 *       path: "/{id}",
 *       args: { params: { id: record.id }, body: { values, expectedVersion } },
 *     }),
 *   );
 *   if (!updated) return;
 *
 *   form.reset(values);
 *   toast.success(t(updated.approval?.status === "pending" ? "pending" : "saved"));
 * };
 *
 * <>{write.conflict}<AutoForm onSubmit={onSubmit} ... /></>;
 * ```
 */
export const useContentPublicWrite = <
  TVersion extends number | undefined = undefined,
>({
  fields,
  latestVersion,
  uniqueField,
  version,
}: {
  /** The form's field names. Issues on other fields become a toast. */
  fields: readonly string[];
  /**
   * Reads the record's current `version`, for "Keep my version" - usually
   * from `GET /{id}/edit`. Without it the conflict alert offers only a reload.
   */
  latestVersion?: () => Promise<null | number>;
  /** Where "already taken" shows on a unique conflict, e.g. the slug's source field. */
  uniqueField?: string;
  /** The version the form opened with, read on the first render. Leave it out for a create. */
  version?: TVersion;
}) => {
  const t = useTranslations("core.global.content_write");
  const versionRef = React.useRef<number | undefined>(version);
  const [hasConflict, setHasConflict] = React.useState(false);
  const [isKeeping, setIsKeeping] = React.useState(false);

  const fail = (message: string) => {
    toast.error(t("title"), { description: message });
  };

  const submit = async <R extends WriteResponse>(
    form: FormApi,
    request: (expectedVersion: TVersion) => Promise<R>,
  ): Promise<null | WrittenRecord<R>> => {
    let res: R;
    try {
      // Starts as `version` and only ever becomes another number, so it keeps
      // the type the caller passed in.
      res = await request(versionRef.current as TVersion);
    } catch {
      fail(t("unknown"));

      return null;
    }

    if (res.ok) {
      const record = (await res.json()) as WrittenRecord<R>;
      versionRef.current = versionOf(record) ?? versionRef.current;
      setHasConflict(false);

      return record;
    }

    const body: unknown = await res.json().catch(() => null);

    if (res.status === 409) {
      const code = (body as null | { code?: unknown })?.code;
      if (code === CONTENT_CONFLICT_CODES.version) {
        setHasConflict(true);
      } else if (uniqueField) {
        setFormFieldError(form, uniqueField, t("unique"));
      } else {
        fail(t("unique"));
      }

      return null;
    }

    const rejection = parseContentPublicWriteRejection(body);
    const unmatched = (rejection?.issues ?? []).filter(issue => {
      if (issue.field === null || !fields.includes(issue.field)) return true;
      setFormFieldError(
        form,
        issue.field,
        t(
          isKnownIssue(issue.code)
            ? `issues.${ISSUE_MESSAGES[issue.code]}`
            : "issues.invalid",
        ),
      );

      return false;
    });

    if (res.status === 400 && rejection && unmatched.length === 0) return null;

    const [first] = unmatched;
    fail(
      first && isKnownIssue(first.code)
        ? t(`issues.${ISSUE_MESSAGES[first.code]}`)
        : isKnownStatus(res.status)
          ? t(STATUS_MESSAGES[res.status])
          : res.status === 400
            ? t("issues.invalid")
            : t("unknown"),
    );

    return null;
  };

  const keepMine = async () => {
    if (!latestVersion) return;
    setIsKeeping(true);
    const latest = await latestVersion().catch(() => null);
    setIsKeeping(false);

    if (latest === null) {
      fail(t("unknown"));

      return;
    }

    versionRef.current = latest;
    setHasConflict(false);
    toast.info(t("conflict.kept.title"), {
      description: t("conflict.kept.desc"),
    });
  };

  const conflict = hasConflict ? (
    <Alert variant="warning">
      <AlertTitle>{t("conflict.title")}</AlertTitle>
      <AlertDescription>
        {t(latestVersion ? "conflict.desc" : "conflict.desc_reload")}
      </AlertDescription>
      <div className="flex flex-wrap gap-2 pt-2">
        {latestVersion ? (
          <Button
            isLoading={isKeeping}
            onClick={keepMine}
            size="sm"
            variant="outline"
          >
            {t("conflict.keep")}
          </Button>
        ) : null}
        <Button
          onClick={() => {
            window.location.reload();
          }}
          size="sm"
          variant="ghost"
        >
          {t("conflict.reload")}
        </Button>
      </div>
    </Alert>
  ) : null;

  return {
    /** The version-conflict alert, or `null`. Render it above the form. */
    conflict,
    /**
     * Sends a write through `request` - given the current `expectedVersion` -
     * and returns the record on a `2xx`, or `null` after showing why not.
     */
    submit,
  };
};
