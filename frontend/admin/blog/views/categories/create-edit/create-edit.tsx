import { useTranslations } from "next-intl";
import { DialogTitle } from "@radix-ui/react-dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { useCreateEditCategoryBlogAdmin } from "./hooks/use-create-edit-category-blog-admin";
import { TextLanguageInput } from "@/components/text-language-input";
import { DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Editor } from "@/components/editor/editor";

interface Props {
  data?: unknown;
}

export const CreateEditCategoryBlogAdmin = ({ data }: Props) => {
  const t = useTranslations("blog.admin.categories");
  const { form, onSubmit } = useCreateEditCategoryBlogAdmin();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t(data ? "edit.title" : "create.title")}</DialogTitle>
        {/* {data?.name && <DialogDescription>{data.name}</DialogDescription>} */}
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("create.name.label")}</FormLabel>
                <FormControl>
                  <TextLanguageInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("create.description.label")}</FormLabel>
                <FormControl>
                  <Editor id="create_categories_blog" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              loading={form.formState.isSubmitting}
              disabled={!form.formState.isValid}
            >
              {t(data ? "edit.submit" : "create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};
