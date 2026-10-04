import { render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AutoFormOnSubmit } from "@/components/form/auto-form";
import { AutoForm, AutoFormSubmitButton } from "@/components/form/auto-form";
import { AutoFormTextarea } from "@/components/form/fields/textarea";
type FileAltLanguage = { code: string; name: string; text: null | string };
type FileAltEditorProps = { onSave: (b: { languageCode: string; text: string }) => Promise<{ data: true } | { error: { status: number } }> };
const AltTextForm = ({
  language,
  onSave,
}: {
  language: FileAltLanguage;
  onSave: FileAltEditorProps["onSave"];
}) => {
  const t = useTranslations("admin.system.files.alt");
  const tError = useTranslations("core.global.errors");

  const formSchema = z.object({
    text: z
      .string()
      .max(1_000)
      .default(language.text ?? ""),
  });

  const onSubmit: AutoFormOnSubmit<typeof formSchema> = async values => {
    const result = await onSave({
      languageCode: language.code,
      text: values.text,
    });

    if ("error" in result) {
      toast.error(tError("title"), {
        description: tError("internal_server_error"),
      });

      return;
    }

    toast.success(t("saved.title"), {
      description:
        values.text.trim() === ""
          ? t("saved.desc_empty", { language: language.name })
          : t("saved.desc", { language: language.name }),
    });
  };

  return (
    <AutoForm
      className="flex flex-col gap-2"
      fields={[
        {
          component: props => (
            <AutoFormTextarea
              {...props}
              aria-label={t("text_label", { language: language.name })}
              rows={2}
            />
          ),
          id: "text",
        },
      ]}
      formSchema={formSchema}
      layout={async fields => fields.text}

    >
      <div className="flex justify-end">
        <AutoFormSubmitButton variant="outline">
          {t("save")}
        </AutoFormSubmitButton>
      </div>
    </AutoForm>
  );
};


const ok = vi.fn(async () => Promise.resolve({ data: true as const }));
describe("debug", () => {
  it("alt form", async () => {
    render(<IntlProvider locale="en" messages={{}} timeZone="UTC"><p>hello</p><AltTextForm language={{ code: "en", name: "English", text: null }} onSave={ok} /></IntlProvider>);
    expect(await screen.findByText("hello", {}, { timeout: 300 })).toBeTruthy();
  });
});
