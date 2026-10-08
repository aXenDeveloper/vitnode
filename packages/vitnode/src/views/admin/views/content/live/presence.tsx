import { cn } from "cn";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

import type { ContentFormSpec } from "@/content/admin/spec";
import type { ContentLiveMember } from "@/content/live/protocol";

import { Avatar } from "@/components/avatar";
import {
  AvatarGroup,
  AvatarGroupCount,
  AvatarGroupItem,
} from "@/components/ui/avatar";

import { useContentLive } from "./context";
import {
  contentLiveFieldEditors,
  contentLiveLanguageEditors,
  contentLiveMemberColor,
  contentLiveOthers,
} from "./presence-model";

const avatarUser = (member: ContentLiveMember) => ({
  avatarColor: contentLiveMemberColor(member.avatarColor).slice(1),
  name: member.name,
  nameCode: member.nameCode ?? member.name,
});

/** "Anna, Ben and Cleo", in the reader's language. */
export const useContentLiveNames = () => {
  const locale = useLocale();

  return (members: readonly ContentLiveMember[]): string =>
    new Intl.ListFormat(locale, { type: "conjunction" }).format(
      members.map(member => member.name),
    );
};

/** "editing Title (PL)": where one member is, from what presence says. */
const useActivity = () => {
  const t = useTranslations("core.content.live.presence");

  return (member: ContentLiveMember, form: ContentFormSpec): string => {
    const language = member.locale?.toUpperCase();
    if (member.field === null) {
      return language && form.defaultLocale !== null
        ? t("in_language", { language })
        : t("viewing");
    }

    const spec = form.fields.find(field => field.name === member.field);
    const field = spec?.label ?? member.field;

    return spec?.localized === true && language
      ? t("editing_field", { field, language })
      : t("editing_shared", { field });
  };
};

/**
 * Everyone else in the record: one avatar per person, however many tabs they
 * have open, with where they are ("Anna, editing Title (PL)") on hover, on
 * focus and for screen readers. Renders nothing outside a live form, or when
 * the editor is alone.
 */
export const ContentLivePresence = ({
  className,
  max = 5,
}: {
  className?: string;
  /** Avatars shown before the rest fold into "+N". */
  max?: number;
}) => {
  const t = useTranslations("core.content.live.presence");
  const live = useContentLive();
  const names = useContentLiveNames();
  const activity = useActivity();
  if (!live?.session.live) return null;

  const others = contentLiveOthers(live.session.members, live.session);
  if (others.length === 0) return null;

  const shown = others.slice(0, max);
  const hidden = others.slice(max);

  return (
    <AvatarGroup
      aria-label={t("label", { count: others.length })}
      className={cn("items-center", className)}
      role="group"
    >
      {shown.map(member => {
        const where = activity(member, live.spec);

        return (
          <AvatarGroupItem
            key={member.userId}
            label={
              <span>
                <span className="font-medium">{member.name}</span>, {where}
              </span>
            }
          >
            <Avatar
              alt={member.name}
              className="ring-background ring-2"
              size={28}
              user={avatarUser(member)}
            />
            <span className="sr-only">{where}</span>
          </AvatarGroupItem>
        );
      })}
      {hidden.length > 0 ? (
        <AvatarGroupItem label={names(hidden)}>
          <AvatarGroupCount className="size-7 text-xs">
            <span aria-hidden>+{hidden.length}</span>
            <span className="sr-only">
              {t("more", { count: hidden.length, names: names(hidden) })}
            </span>
          </AvatarGroupCount>
        </AvatarGroupItem>
      ) : null}
    </AvatarGroup>
  );
};

const SmallAvatars = ({
  members,
  max = 3,
}: {
  max?: number;
  members: readonly ContentLiveMember[];
}) => (
  <span aria-hidden className="inline-flex items-center *:not-first:-ms-1.5">
    {members.slice(0, max).map(member => (
      <Avatar
        alt=""
        className="ring-background ring-2"
        key={member.userId}
        size={20}
        title={member.name}
        user={avatarUser(member)}
      />
    ))}
    {members.length > max ? (
      <span className="bg-muted text-muted-foreground ring-background inline-flex size-5 items-center justify-center rounded-full text-xs tabular-nums ring-2">
        +{members.length - max}
      </span>
    ) : null}
  </span>
);

/**
 * The other people in one field, as small avatars - for a field's label. A
 * localized field counts only the people in `locale`. Renders nothing outside
 * a live form or when the field is free.
 */
export const ContentLiveFieldPresence = ({
  className,
  decorative = false,
  field,
  locale,
}: {
  className?: string;
  /** The avatars only: the field announces its editors some other way. */
  decorative?: boolean;
  field: string;
  /** The language shown, `null` for a field that is not localized. */
  locale: null | string;
}) => {
  const t = useTranslations("core.content.live.presence");
  const live = useContentLive();
  const names = useContentLiveNames();
  if (!live?.session.live) return null;

  const editors = contentLiveFieldEditors(live.session.members, live.session, {
    field,
    locale,
  });
  if (editors.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <SmallAvatars members={editors} />
      {decorative ? null : (
        <span className="sr-only">
          {t("field", { count: editors.length, names: names(editors) })}
        </span>
      )}
    </span>
  );
};

/**
 * The other people working in one language - of the whole record, or of one
 * field when `field` is given. For a language switcher.
 */
export const ContentLiveLanguagePresence = ({
  className,
  field,
  locale,
}: {
  className?: string;
  field?: string;
  locale: string;
}) => {
  const t = useTranslations("core.content.live.presence");
  const live = useContentLive();
  const names = useContentLiveNames();
  if (!live?.session.live) return null;

  const editors = contentLiveLanguageEditors(
    live.session.members,
    live.session,
    { field, locale },
  );
  if (editors.length === 0) return null;

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <SmallAvatars members={editors} />
      <span className="sr-only">
        {t("language", { count: editors.length, names: names(editors) })}
      </span>
    </span>
  );
};
