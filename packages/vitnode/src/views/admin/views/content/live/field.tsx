import React from "react";
import { useTranslations } from "use-intl";

import type { AnyFormFieldApi } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";
import type { ContentFieldLock } from "@/content/live/protocol";

import { useMultiLangLanguage } from "@/components/form/fields/multi-lang-language";
import {
  type MultiLangPresence,
  MultiLangPresenceContext,
  MultiLangShownLanguageContext,
} from "@/components/form/fields/multi-lang-presence";
import { EditorCollaborationContext } from "@/components/tiptap/collaboration";
import {
  contentApiValueToFormField,
  contentFormFieldToApi,
} from "@/content/admin/spec";
import { CONTENT_FIELD_LOCK_RENEW_MS } from "@/content/live/protocol";

import type { ContentLiveContextValue } from "./context";

import { useContentFormTransport } from "../form/transport";
import { useContentLive } from "./context";
import { ContentLiveFieldOutline } from "./outline";
import { ContentLiveLanguagePresence, useContentLiveNames } from "./presence";
import {
  contentLiveFieldEditors,
  contentLiveLanguageEditors,
} from "./presence-model";
import {
  ContentLiveRichTextFieldContext,
  renderContentLiveCollaborativeEditor,
} from "./rich-text-field";

/**
 * How long a field keeps its lock after focus leaves it. A select or a picker
 * opens its list in a portal outside the field, and focus coming straight back
 * must not cost the lock - or a round trip.
 */
export const CONTENT_FIELD_LOCK_BLUR_GRACE_MS = 1_500;

const isRichText = (kind: string): boolean => kind === "richText";

const isExpired = (lock: ContentFieldLock): boolean =>
  Date.parse(lock.expiresAt) <= Date.now();

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const LockNotice = ({
  id,
  lock,
}: {
  id: string;
  lock: ContentFieldLock | null;
}) => {
  const t = useTranslations("core.content.live");

  return (
    <p aria-live="polite" className="sr-only" id={id}>
      {lock ? (
        <>
          {lock.user.name} {t("is_editing")}. {t("locked_desc")}
        </>
      ) : null}
    </p>
  );
};

const LiveField = ({
  children,
  field,
  fieldSpec,
  live,
}: {
  children: React.ReactNode;
  field: AnyFormFieldApi;
  fieldSpec: ContentFormFieldSpec;
  live: ContentLiveContextValue;
}) => {
  const t = useTranslations("core.content.live.presence");
  const names = useContentLiveNames();
  const transport = useContentFormTransport();
  const pinned = useMultiLangLanguage();
  const badgeId = React.useId();
  const presenceId = React.useId();
  const { autosave, session, spec } = live;
  const name = fieldSpec.name;
  const localized = fieldSpec.localized === true;
  /** The language the field's own switcher shows, when it has one. */
  const [shown, setShown] = React.useState<null | string>(null);
  const locale = localized ? (pinned ?? shown ?? live.locale) : null;
  // Rich text is co-edited through Yjs once the socket let this tab in, so
  // everyone types in it at once and it takes no lock - and its shared
  // document is its autosave. Without a socket it is a locked field.
  const coEdited = isRichText(fieldSpec.kind) && live.coEditing;
  const lockable = !coEdited;

  const [held, setHeld] = React.useState(false);
  const heldRef = React.useRef(false);
  /** The language of the lock held: the switcher may have moved on since. */
  const heldLocaleRef = React.useRef<null | string>(null);
  const busyRef = React.useRef<Promise<void>>(Promise.resolve());
  const releaseTimerRef =
    React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const focusedRef = React.useRef(false);

  const lock =
    session.locks.find(
      entry =>
        entry.field === name && entry.locale === locale && !isExpired(entry),
    ) ?? null;
  const lockedByOther =
    lockable &&
    !held &&
    lock !== null &&
    (session.self === null || lock.user.id !== session.self);

  const markHeld = (value: boolean) => {
    heldRef.current = value;
    setHeld(value);
  };

  const request = async (
    action: "acquire" | "release" | "renew",
    lockLocale: null | string,
  ) =>
    await transport.lock(spec.contentTypeId, live.itemId, {
      action,
      field: name,
      locale: lockLocale,
    });

  const acquire = async () => {
    if (heldRef.current || !lockable) return;

    const target = locale;
    const result = await request("acquire", target);
    if (result.lock) {
      session.rememberSelf(result.lock.user.id);
      heldLocaleRef.current = target;
      markHeld(focusedRef.current);
      if (!focusedRef.current) await request("release", target);

      return;
    }
    // Someone got there first: the list says who, so the field turns read-only.
    void session.refreshLocks();
  };

  const release = async () => {
    if (!heldRef.current) return;

    await autosave.flush();
    markHeld(false);
    await request("release", heldLocaleRef.current);
  };

  const renew = async () => {
    if (!heldRef.current) return;

    const result = await request("renew", heldLocaleRef.current);
    if (result.lock) return;

    // The lease ran out and someone else took it, or it vanished.
    markHeld(false);
    if (focusedRef.current) await acquire();
    else void session.refreshLocks();
  };

  // Timers and the unmount cleanup outlive the render that scheduled them, so
  // they reach the lock through the latest render's functions.
  const actionsRef = React.useRef({ acquire, release, renew });
  React.useEffect(() => {
    actionsRef.current = { acquire, release, renew };
  });

  /** One lock request at a time per field, in the order they were asked. */
  const run = (action: "acquire" | "release" | "renew") => {
    const task = async () => {
      await actionsRef.current[action]();
    };
    busyRef.current = busyRef.current.then(task, task);
  };

  React.useEffect(() => {
    if (!held) return;

    const timer = setInterval(() => {
      run("renew");
    }, CONTENT_FIELD_LOCK_RENEW_MS);

    return () => {
      clearInterval(timer);
    };
  }, [held]);

  React.useEffect(
    () => () => {
      clearTimeout(releaseTimerRef.current);
      if (heldRef.current) run("release");
    },
    [],
  );

  // Another language on the switcher is another lock: give the old one back
  // and, still in the field, take the new one.
  React.useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- the language moves inside the field's own switcher, which knows nothing of locks
    if (!heldRef.current || heldLocaleRef.current === locale) return;

    run("release");
    if (focusedRef.current) run("acquire");
  }, [locale]);

  // Autosave what this person types, while the field is theirs - from the
  // first change after taking the lock, so merely visiting a field writes
  // nothing.
  const valueKey = JSON.stringify(field.value ?? null);
  const baselineRef = React.useRef<null | string>(null);
  /** The value when focus arrived, which can be before the lock did. */
  const focusValueRef = React.useRef<null | string>(null);
  const queueChange = React.useEffectEvent(() => {
    if (!held || !lockable) {
      baselineRef.current = null;

      return;
    }
    baselineRef.current ??= focusValueRef.current ?? valueKey;
    if (baselineRef.current === valueKey) return;

    // Once changed, every later value goes out - reverting is a change too.
    baselineRef.current = "";
    const converted = contentFormFieldToApi(
      spec,
      fieldSpec,
      field.value,
      locale,
    );
    if (converted) autosave.queue(name, locale, converted.value);
  });
  React.useEffect(() => {
    queueChange();
  }, [held, valueKey]);

  // Everyone else's autosaves land in this field - never while it is ours.
  const applyDraft = React.useEffectEvent(
    (event: { locale: null | string; values: Record<string, unknown> }) => {
      // A co-edited document arrives through Yjs, never through the draft.
      if (!lockable || !(name in event.values)) return;
      if (heldRef.current && event.locale === locale) return;
      if (
        fieldSpec.localized === true
          ? event.locale === null
          : event.locale !== null
      ) {
        return;
      }

      const next = contentApiValueToFormField(
        fieldSpec,
        event.values[name],
        field.value,
        event.locale,
      );
      if (!same(next, field.value)) field.onChange(next);
    },
  );

  const { onDraft } = session;
  // eslint-disable-next-line react-you-might-not-need-an-effect/no-pass-data-to-parent -- a subscription to the session's draft events, nothing handed upwards
  React.useEffect(() => onDraft(applyDraft), [onDraft]);

  const onFocusCapture = () => {
    if (!focusedRef.current) focusValueRef.current = valueKey;
    focusedRef.current = true;
    clearTimeout(releaseTimerRef.current);
    session.focus(name, locale);
    if (!lockedByOther) run("acquire");
  };

  const onBlurCapture = (event: React.FocusEvent<HTMLFieldSetElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;

    focusedRef.current = false;
    session.focus(null, locale);
    clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      if (!focusedRef.current) run("release");
    }, CONTENT_FIELD_LOCK_BLUR_GRACE_MS);
  };

  const editors = session.live
    ? contentLiveFieldEditors(session.members, session, { field: name, locale })
    : [];
  const holder =
    lockedByOther && lock
      ? {
          avatarColor:
            session.members.find(member => member.userId === lock.user.id)
              ?.avatarColor ?? null,
          name: lock.user.name,
          userId: lock.user.id,
        }
      : null;
  const outlined = coEdited
    ? []
    : [
        ...(holder ? [holder] : []),
        ...editors.filter(member => member.userId !== holder?.userId),
      ];
  const describedBy =
    [lockedByOther ? badgeId : null, editors.length > 0 ? presenceId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const languagePresence: MultiLangPresence | null =
    localized && session.live
      ? {
          busy: code =>
            contentLiveLanguageEditors(session.members, session, {
              field: name,
              locale: code,
            }).length > 0,
          marker: code => (
            <ContentLiveLanguagePresence
              className="ms-auto"
              field={name}
              locale={code}
            />
          ),
        }
      : null;

  let content = children;
  if (coEdited) {
    content = (
      <ContentLiveRichTextFieldContext value={name}>
        <EditorCollaborationContext
          value={renderContentLiveCollaborativeEditor}
        >
          {content}
        </EditorCollaborationContext>
      </ContentLiveRichTextFieldContext>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <fieldset
        aria-describedby={describedBy}
        className="relative min-w-0"
        disabled={lockedByOther}
        onBlurCapture={onBlurCapture}
        onFocusCapture={onFocusCapture}
      >
        <MultiLangShownLanguageContext value={setShown}>
          <MultiLangPresenceContext value={languagePresence}>
            {content}
          </MultiLangPresenceContext>
        </MultiLangShownLanguageContext>
        <ContentLiveFieldOutline members={outlined} />
      </fieldset>
      {editors.length > 0 ? (
        <span className="sr-only" id={presenceId}>
          {t("field", {
            count: editors.length,
            names: names(editors),
          })}
        </span>
      ) : null}
      <LockNotice id={badgeId} lock={lockedByOther ? lock : null} />
    </div>
  );
};

/**
 * One form field inside a live session: focusing it takes the field's lock,
 * leaving it gives the lock back, and while someone else holds it the field is
 * read-only with their name beside it. Outside a live form it renders the
 * field untouched.
 */
export const ContentLiveField = ({
  children,
  field,
  fieldSpec,
}: {
  children: React.ReactNode;
  field: AnyFormFieldApi;
  fieldSpec: ContentFormFieldSpec;
}) => {
  const live = useContentLive();
  if (!live) return <>{children}</>;

  return (
    <LiveField field={field} fieldSpec={fieldSpec} live={live}>
      {children}
    </LiveField>
  );
};
