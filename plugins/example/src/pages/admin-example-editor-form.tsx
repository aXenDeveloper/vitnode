import { AutoForm } from "@vitnode/core/components/form/auto-form";
import { AutoFormEditor } from "@vitnode/core/components/form/fields/editor";
import { AutoFormInput } from "@vitnode/core/components/form/fields/input";
import { stripHtml } from "@vitnode/core/lib/strip-html";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { z } from "zod";

const SAMPLE_DESCRIPTION = `
<h2>What happened</h2>
<p>Customers with more than 40 items in the cart see a blank page after pressing <strong>Place order</strong> whenever the promo service takes longer than <code>3000ms</code> to answer.</p>
<div data-panel="warning" class="tiptap-panel"><p>Only eu-west-1 is affected</p><p>Other regions answer in under half a second, so the fix can ship there first.</p></div>
<h3>Acceptance criteria</h3>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Checkout falls back to the undiscounted total on a timeout</p></li><li data-type="taskItem" data-checked="false"><p>The customer sees an error with a retry button instead of a blank page</p></li></ul>
`;

export const AdminExampleEditorForm = () => {
  const t = useTranslations("@vitnode/example.admin.overview.form");
  const formSchema = z.object({
    summary: z
      .string()
      .trim()
      .min(1)
      .default("Checkout returns 502 when the promo service is slow"),
    description: z
      .string()
      .refine(html => stripHtml(html) !== "", t("description.required"))
      .default(SAMPLE_DESCRIPTION),
    comment: z.string().optional(),
  });

  return (
    <section
      aria-labelledby="admin-example-editor-form"
      className="flex flex-col gap-4"
    >
      <header className="flex flex-col gap-2">
        <h2
          className="text-xl font-semibold tracking-tight text-balance"
          id="admin-example-editor-form"
        >
          {t("title")}
        </h2>

        <p className="text-muted-foreground leading-relaxed text-pretty">
          {t("desc")}
        </p>
      </header>

      <AutoForm
        fields={[
          {
            id: "summary",
            component: props => (
              <AutoFormInput {...props} label={t("summary.label")} />
            ),
          },
          {
            id: "description",
            component: props => (
              <AutoFormEditor
                {...props}
                description={t("description.desc")}
                disableScroll
                label={t("description.label")}
              />
            ),
          },
          {
            id: "comment",
            component: props => (
              <AutoFormEditor
                {...props}
                label={t("comment.label")}
                placeholder={t("comment.placeholder")}
              />
            ),
          },
        ]}
        formSchema={formSchema}
        onSubmit={values => {
          const words = stripHtml(values.description)
            .split(/\s+/)
            .filter(Boolean).length;

          toast.success(t("success.title"), {
            description: t("success.desc", { words }),
          });
        }}
        submitButtonProps={{ children: t("submit") }}
      />
    </section>
  );
};
