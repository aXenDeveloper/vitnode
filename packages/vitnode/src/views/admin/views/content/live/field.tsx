import React from "react";
import { useTranslations } from "use-intl";

import type { AnyFormFieldApi } from "@/components/form/auto-form";
import type { ContentFormFieldSpec } from "@/content/admin/spec";
import type { ContentFieldLock } from "@/content/live/protocol";

import { Avatar } from "@/components/avatar";
import { useMultiLangLanguage } from "@/components/form/fields/multi-lang-language";
import {
  contentApiValueToFormField,
  contentFormFieldToApi,
} from "@/content/admin/spec";
import { CONTENT_FIELD_LOCK_RENEW_MS } from "@/content/live/protocol";

import type { ContentLiveContextValue } from "./context";

import { useContentFormTransport } from "../form/transport";
import { useContentLive } from "./context";

/**
 * How long a field keeps its lock after focus leaves it. A select or a picker
 * opens its list in a portal outside the field, and focus coming straight back
 * must not cost the lock - or a round trip.
 */
export const CONTENT_FIELD_LOCK_BLUR_GRACE_MS = 1_500;

/** `richText` is not a field kind yet: it arrives with the rich text phase. */
const isRichText = (kind: string): boolean => kind === "richText";

const isExpired = (lock: ContentFieldLock): boolean =>
  Date.parse(lock.expiresAt) <= Date.now();

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Who holds a field, as the badge shows them. */
export const ContentFieldLockBadge = ({
  id,
  lock,
  live,
}: {
  id: string;
  live: ContentLiveContextValue;
  lock: ContentFieldLock | null;
}) => {
  const t = useTranslations("core.content.live");
  const member = lock
    ? live.session.members.find(entry => entry.userId === lock.user.id)
    : undefined;

  return (
    <div aria-live="polite" id={id}>
      {lock ? (
        <p className="bg-muted text-muted-foreground mt-2 inline-flex max-w-full rounded-full py-1 pr-3 pl-1 text-sm leading-relaxed">
          <span className="flex min-w-0 items-center gap-2">
            <Avatar
              alt=""
              className="shrink-0"
              size={20}
              user={{
                avatarColor: member?.avatarColor ?? "71717a",
                name: lock.user.name,
                nameCode: member?.nameCode ?? lock.user.name,
              }}
            />
            <span className="truncate">
              <span className="text-foreground font-medium">
                {lock.user.name}
              </span>{" "}
              {t("is_editing")}
            </span>
          </span>
          <span className="sr-only">{t("locked_desc")}</span>
        </p>
      ) : null}
    </div>
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
  const transport = useContentFormTransport();
  const pinned = useMultiLangLanguage();
  const badgeId = React.useId();
  const { autosave, session, spec } = live;
  const name = fieldSpec.name;
  const locale = fieldSpec.localized === true ? (pinned ?? live.locale) : null;
  // Rich text is co-edited through Yjs while the socket is live, so everyone
  // types in it at once and it takes no lock; without a socket it locks.
  const lockable = !(isRichText(fieldSpec.kind) && session.live);

  const [held, setHeld] = React.useState(false);
  const heldRef = React.useRef(false);
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

  const request = async (action: "acquire" | "release" | "renew") =>
    await transport.lock(spec.contentTypeId, live.itemId, {
      action,
      field: name,
      locale,
    });

  const acquire = async () => {
    if (heldRef.current || !lockable) return;

    const result = await request("acquire");
    if (result.lock) {
      session.rememberSelf(result.lock.user.id);
      markHeld(focusedRef.current);
      if (!focusedRef.current) await request("release");

      return;
    }
    // Someone got there first: the list says who, so the field turns read-only.
    void session.refreshLocks();
  };

  const release = async () => {
    if (!heldRef.current) return;

    await autosave.flush();
    markHeld(false);
    await request("release");
  };

  const renew = async () => {
    if (!heldRef.current) return;

    const result = await request("renew");
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

  // Autosave what this person types, while the field is theirs - from the
  // first change after taking the lock, so merely visiting a field writes
  // nothing.
  const valueKey = JSON.stringify(field.value ?? null);
  const baselineRef = React.useRef<null | string>(null);
  /** The value when focus arrived, which can be before the lock did. */
  const focusValueRef = React.useRef<null | string>(null);
  const queueChange = React.useEffectEvent(() => {
    if (!held) {
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
      if (!(name in event.values)) return;
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
    session.focus(null, null);
    clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      if (!focusedRef.current) run("release");
    }, CONTENT_FIELD_LOCK_BLUR_GRACE_MS);
  };

  return (
    <div className="flex min-w-0 flex-col">
      <fieldset
        aria-describedby={lockedByOther ? badgeId : undefined}
        className="min-w-0"
        disabled={lockedByOther}
        onBlurCapture={onBlurCapture}
        onFocusCapture={onFocusCapture}
      >
        {children}
      </fieldset>
      <ContentFieldLockBadge
        id={badgeId}
        live={live}
        lock={lockedByOther ? lock : null}
      />
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
