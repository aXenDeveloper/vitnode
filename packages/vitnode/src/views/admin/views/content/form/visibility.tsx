import { useTranslations } from "use-intl";

import { HiddenIcon } from "@/components/hidden-icon";
import { Button } from "@/components/ui/button";
import {
  contentVisibilityTransition,
  isContentHidden,
} from "@/content/visibility";

import {
  CONTENT_VISIBILITY_ICONS,
  ContentVisibilityDialog,
} from "../actions/visibility-dialog";
import { useContentForm } from "./context";

export const useContentFormHidden = (): boolean => {
  const { mode, visibility } = useContentForm();

  return (
    mode === "edit" &&
    visibility?.enabled === true &&
    isContentHidden({ hiddenAt: visibility.hiddenAt })
  );
};

export const ContentFormHiddenIcon = ({
  className,
}: {
  className?: string;
}) => {
  const t = useTranslations("core.content.visibility");
  const { singular } = useContentForm();
  const hidden = useContentFormHidden();

  if (!hidden) return null;

  return (
    <HiddenIcon
      className={className}
      label={t("hidden_record", { name: singular })}
    />
  );
};

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
