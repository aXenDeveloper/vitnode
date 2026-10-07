import { useFormatter, useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { TooltipWithContent } from "@/components/ui/tooltip";
import {
  contentVisibilityTransition,
  isContentHidden,
} from "@/content/visibility";

import {
  CONTENT_VISIBILITY_ICONS,
  ContentVisibilityDialog,
} from "../actions/visibility-dialog";
import { ContentHiddenBadge } from "../lib/hidden-badge";
import { useContentForm } from "./context";

/** Whether the record this form edits is hidden right now. */
export const useContentFormHidden = (): boolean => {
  const { mode, visibility } = useContentForm();

  return (
    mode === "edit" &&
    visibility?.enabled === true &&
    isContentHidden({ hiddenAt: visibility.hiddenAt })
  );
};

/**
 * "Hidden", beside the status - with since when, for anyone who hovers it.
 * Nothing for a visible record, a create, or a content type without visibility.
 */
export const ContentFormHiddenBadge = () => {
  const t = useTranslations("core.content.visibility");
  const format = useFormatter();
  const { visibility } = useContentForm();
  const hidden = useContentFormHidden();

  if (!hidden) return null;

  const since =
    typeof visibility?.hiddenAt === "string"
      ? new Date(visibility.hiddenAt)
      : null;
  const badge = (
    <ContentHiddenBadge
      label={t("hidden")}
      row={{ hiddenAt: visibility?.hiddenAt }}
    />
  );

  if (!since || Number.isNaN(since.getTime())) return badge;

  return (
    <TooltipWithContent
      text={t("hidden_since", {
        date: format.dateTime(since, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      })}
    >
      <span className="inline-flex">{badge}</span>
    </TooltipWithContent>
  );
};

/**
 * What hiding means, in words, wherever the editor sees a hidden record's
 * status: off the public site, and publishing alone does not bring it back.
 */
export const ContentFormHiddenNotice = () => {
  const t = useTranslations("core.content.visibility");
  const hidden = useContentFormHidden();

  if (!hidden) return null;

  return (
    <p className="text-muted-foreground text-sm leading-relaxed text-pretty">
      {t("hidden_desc")}
    </p>
  );
};

/**
 * Hide or unhide the record being edited, behind the same confirmation the list
 * uses. Gated by `can_hide`; absent while creating, and for a content type
 * without visibility.
 */
export const ContentFormVisibilityToggle = () => {
  const tActions = useTranslations("core.content.actions");
  const { mode, singular, title, visibility } = useContentForm();

  if (
    mode !== "edit" ||
    !visibility?.enabled ||
    !visibility.canHide ||
    !visibility.transition
  ) {
    return null;
  }

  const { transition } = visibility;
  const { action } = contentVisibilityTransition({
    hiddenAt: visibility.hiddenAt,
  });

  return (
    <ContentVisibilityDialog
      action={action}
      onConfirm={async () => await transition(action)}
      singular={singular}
      title={title ?? singular}
    >
      <Button type="button" variant="outline">
        {CONTENT_VISIBILITY_ICONS[action]}
        {tActions(action)}
      </Button>
    </ContentVisibilityDialog>
  );
};
