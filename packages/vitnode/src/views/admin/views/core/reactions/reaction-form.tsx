import { useSelector } from "@tanstack/react-form";
import { multiLangValueSchema } from "@vitnode/api/lib/helpers/multi-lang";
import {
  REACTION_CODE_PATTERN,
  REACTIONS_LIMITS,
} from "@vitnode/api/lib/reactions/const";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";
import { z } from "zod";

import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import type {
  AdminMutationError,
  AdminMutationResult,
} from "@/views/admin/views/core/shared/admin-mutation";

import { AutoForm } from "@/components/form/auto-form";
import { AutoFormEmojiIcon } from "@/components/form/fields/emoji-icon";
import { AutoFormInput } from "@/components/form/fields/input";
import { AutoFormNumber } from "@/components/form/fields/number";
import { AutoFormRadioGroup } from "@/components/form/fields/radio-group";
import { AutoFormSwitch } from "@/components/form/fields/switch";
import { MotionFeatures } from "@/components/motion-features";
import { useFormApi } from "@/components/ui/form";
import { reactionTitle } from "@/tanstack/reactions/query";

import type { ReactionImageValue } from "./reaction-image-field";
import type { AdminReactionInput } from "./reactions-mutations";
import type { AdminReaction } from "./reactions-query";

import { ReactionImageField } from "./reaction-image-field";
import {
  hasReactionLook,
  ReactionLivePreview,
  reactionLookOf,
} from "./reaction-preview";
import { ReactionRolesField } from "./reaction-roles-field";
import {
  REACTION_STEPS,
  ReactionStepFooter,
  ReactionStepNav,
  ReactionStepPanel,
  useReactionSteps,
} from "./reaction-steps";

export interface ReactionFormProps {
  onSave: (args: {
    id?: number;
    values: AdminReactionInput;
  }) => Promise<AdminMutationResult<{ id: number; recounting?: boolean }>>;
  onSaved: () => void;
  reaction?: AdminReaction;
}

const SOURCES = ["symbol", "image"] as const;

const reactionFormSchema = (
  reaction: AdminReaction | undefined,
  codeMessage: string,
  requiredMessage: string,
) => {
  const imageDefault: null | ReactionImageValue =
    reaction?.kind === "image" && reaction.image && reaction.fileId !== null
      ? {
          fileId: reaction.fileId,
          image: reaction.image,
          posterFileId: reaction.posterFileId,
        }
      : null;

  return z.object({
    source: z
      .enum(SOURCES)
      .default(reaction?.kind === "image" ? "image" : "symbol"),
    symbol: z
      .string()
      .default(reaction?.kind === "image" ? "" : (reaction?.icon ?? "")),
    image: z
      .object({
        fileId: z.number().int(),
        image: z.object({
          animated: z.boolean(),
          height: z.number().int().nullable(),
          posterUrl: z.string().nullable(),
          url: z.string(),
          width: z.number().int().nullable(),
        }),
        posterFileId: z.number().int().nullable(),
      })
      .nullable()
      .default(imageDefault),
    title: multiLangValueSchema({
      maxLength: REACTIONS_LIMITS.titleMaxLength,
      minLength: 1,
    })
      .min(1, { message: requiredMessage })
      .default(reaction?.title ?? []),
    code: z
      .string()
      .min(1)
      .max(32)
      .regex(REACTION_CODE_PATTERN, codeMessage)
      .default(reaction?.code ?? ""),
    enabled: z.boolean().default(reaction?.enabled ?? true),
    points: z
      .number()
      .int()
      .min(-REACTIONS_LIMITS.maxPoints)
      .max(REACTIONS_LIMITS.maxPoints)
      .default(reaction?.points ?? 1),
    allRoles: z.boolean().default(reaction?.allRoles ?? true),
    roles: z
      .array(
        z.object({
          dailyLimit: z.number().int().min(1).nullable(),
          roleId: z.number().int(),
        }),
      )
      .default(reaction?.roles ?? []),
  });
};

export type ReactionFormValues = z.infer<ReturnType<typeof reactionFormSchema>>;

/** The message key for a reaction saved without its emoji, icon or image. */
const missingLookKey = (values: ReactionFormValues) => {
  if (values.source === "image") {
    return values.image ? null : "image_required";
  }

  return hasReactionLook(values) ? null : "look_required";
};

const toReactionInput = (values: ReactionFormValues): AdminReactionInput => {
  const image = values.source === "image" ? values.image : null;
  const look = reactionLookOf(values);

  return {
    allRoles: values.allRoles,
    code: values.code,
    enabled: values.enabled,
    fileId: image?.fileId ?? null,
    icon: look.icon,
    kind: look.kind,
    points: values.points,
    posterFileId: image?.posterFileId ?? null,
    // With every role allowed, only the roles with a daily limit need a rule.
    roles: values.allRoles
      ? values.roles.filter(rule => rule.dailyLimit !== null)
      : values.roles,
    title: values.title,
  };
};

const saveErrorDescription = (
  error: AdminMutationError,
  t: ReturnType<typeof useTranslations<"admin.reactions.form">>,
): string => {
  if (error.status !== 409) return t("error_desc");
  if (error.message?.includes("limit_reached")) {
    return t("limit_reached", { max: REACTIONS_LIMITS.maxReactions });
  }

  return t("code_taken");
};

const ReactionStepsLayout = ({
  isEdit,
  rendered,
}: {
  isEdit: boolean;
  rendered: Record<string, React.ReactNode>;
}) => {
  const t = useTranslations("admin.reactions.form");
  const locale = useLocale();
  const { form } = useFormApi();
  const values = useSelector(
    form.store,
    state => state.values as ReactionFormValues,
  );
  const { pick, step, visited } = useReactionSteps(isEdit);
  const title = reactionTitle(
    {
      code: values.code || t("preview"),
      title: values.title.filter(item => item.value.trim() !== ""),
    },
    locale,
  );

  return (
    <MotionFeatures withLayoutAndDrag>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="bg-muted/40 flex shrink-0 flex-col gap-2 border-b p-2 md:w-64 md:border-e md:border-b-0 md:p-3">
          <div className="hidden md:block">
            <ReactionLivePreview title={title} values={values} />
          </div>
          <ReactionStepNav
            active={step.active}
            onPick={pick}
            title={title}
            values={values}
            visited={visited}
          />
        </aside>
        <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
          {REACTION_STEPS.map(item => (
            <ReactionStepPanel
              direction={step.direction}
              instant={step.instant}
              isActive={item.id === step.active}
              key={item.id}
            >
              <h3 className="text-base font-semibold text-balance">
                {t(`sections.${item.id}`)}
              </h3>
              {item.fields.map(name => (
                <React.Fragment key={name}>{rendered[name]}</React.Fragment>
              ))}
            </ReactionStepPanel>
          ))}
        </div>
      </div>
      <ReactionStepFooter active={step.active} isEdit={isEdit} onPick={pick} />
    </MotionFeatures>
  );
};

/** Create or edit one reaction in four steps: look, details, reputation and roles. */
export const ReactionForm = ({
  onSave,
  onSaved,
  reaction,
}: ReactionFormProps) => {
  const t = useTranslations("admin.reactions.form");
  const tErrors = useTranslations("core.global.errors");
  const locale = useLocale();
  const formSchema = reactionFormSchema(
    reaction,
    t("code_desc"),
    tErrors("field_required"),
  );

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const lookKey = missingLookKey(values);
    if (lookKey) {
      toast.error(t("error"), { description: t(lookKey) });

      return;
    }

    const result = await onSave({
      id: reaction?.id,
      values: toReactionInput(values),
    });
    if ("error" in result) {
      toast.error(t("error"), {
        description: saveErrorDescription(result.error, t),
      });

      return;
    }

    if (reaction) {
      toast.success(t("updated"), {
        description: result.data.recounting
          ? `${t("updated_desc")} ${t("recounting")}`
          : t("updated_desc"),
      });
    } else {
      toast.success(t("created"), {
        description: t("created_desc", {
          reaction: reactionTitle(
            { code: values.code, title: values.title },
            locale,
          ),
        }),
      });
    }
    onSaved();
  };

  return (
    <AutoForm
      className="flex min-h-0 flex-1 flex-col gap-0"
      fields={[
        {
          id: "source",
          component: props => (
            <AutoFormRadioGroup
              {...props}
              label={t("kind")}
              labels={[
                {
                  description: t("kind_symbol_desc"),
                  label: t("kind_symbol"),
                  value: "symbol",
                },
                {
                  description: t("kind_image_desc"),
                  label: t("kind_image"),
                  value: "image",
                },
              ]}
              variant="blocks"
            />
          ),
        },
        {
          id: "symbol",
          hidden: values => values.source !== "symbol",
          component: props => (
            <AutoFormEmojiIcon {...props} label={t("symbol")} />
          ),
        },
        {
          id: "image",
          hidden: values => values.source !== "image",
          component: props => (
            <ReactionImageField {...props} label={t("image")} />
          ),
        },
        {
          id: "title",
          component: props => (
            <AutoFormInput {...props} label={t("title")} multiLang />
          ),
        },
        {
          id: "code",
          component: props => (
            <AutoFormInput
              {...props}
              description={t("code_desc")}
              label={t("code")}
            />
          ),
        },
        {
          id: "enabled",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("enabled_desc")}
              label={t("enabled")}
            />
          ),
        },
        {
          id: "points",
          component: props => (
            <AutoFormNumber
              {...props}
              description={t("points_desc")}
              label={t("points")}
              max={REACTIONS_LIMITS.maxPoints}
              min={-REACTIONS_LIMITS.maxPoints}
            />
          ),
        },
        {
          id: "allRoles",
          component: props => (
            <AutoFormSwitch
              {...props}
              description={t("all_roles_desc")}
              label={t("all_roles")}
            />
          ),
        },
        {
          id: "roles",
          component: props => (
            <ReactionRolesField {...props} label={t("roles")} />
          ),
        },
      ]}
      formSchema={formSchema}
      id={reaction ? `reaction-${reaction.id}` : "reaction-new"}
      layout={rendered => (
        <ReactionStepsLayout isEdit={!!reaction} rendered={rendered} />
      )}
      onSubmit={onSubmit}
    />
  );
};

export default ReactionForm;
