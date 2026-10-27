import { EyeOffIcon } from "lucide-react";
import { useTranslations } from "use-intl";
import { z } from "zod";

import {
  AutoForm,
  type AutoFormOnSubmit,
  AutoFormSubmitButton,
} from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
import { Button } from "@/components/ui/button";
import { CONTENT_HIDDEN_REASON_MAX_LENGTH } from "@/content/const";

export interface ContentCommentHideFormProps {
  onCancel: () => void;
  /** Hides the comment; `reason` is `null` when left empty. */
  onHide: (reason: null | string) => Promise<void>;
}

const formSchema = z.object({
  hideReason: z
    .string()
    .trim()
    .max(CONTENT_HIDDEN_REASON_MAX_LENGTH)
    .default(""),
});

/** The optional reason asked before hiding a comment. Lazy-loaded. */
const ContentCommentHideForm = ({
  onCancel,
  onHide,
}: ContentCommentHideFormProps) => {
  const t = useTranslations("core.comments");

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async ({
    hideReason,
  }) => {
    await onHide(hideReason === "" ? null : hideReason);
  };

  return (
    <AutoForm
      className="flex flex-col gap-3"
      fields={[
        {
          id: "hideReason",
          component: props => (
            <AutoFormTextarea
              {...props}
              autoFocus
              className="min-h-20 text-base md:text-sm"
              description={t("visibility.hide.reason_desc")}
              label={t("visibility.hide.reason")}
            />
          ),
        },
      ]}
      formSchema={formSchema}
      layout={fields => <>{fields.hideReason}</>}
      mode="onSubmit"
      onSubmit={onSubmit}
    >
      <div className="flex flex-wrap items-center gap-2">
        <AutoFormSubmitButton>
          <EyeOffIcon aria-hidden="true" />
          {t("visibility.hide.action")}
        </AutoFormSubmitButton>
        <Button onClick={onCancel} type="button" variant="ghost">
          {t("form.cancel")}
        </Button>
      </div>
    </AutoForm>
  );
};

export default ContentCommentHideForm;
