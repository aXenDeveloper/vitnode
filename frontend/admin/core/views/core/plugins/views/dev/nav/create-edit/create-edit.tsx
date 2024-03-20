import { useTranslations } from "next-intl";

import {
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useCreateNavPluginAdmin } from "./hooks/use-create-nav-plugin-admin";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { IconInput } from "@/components/icon/input/icon-input";
import type { ShowAdminNavPluginsObj } from "@/graphql/hooks";

interface Props {
  data?: ShowAdminNavPluginsObj;
}

export const CreateEditNavDevPluginAdmin = ({ data }: Props) => {
  const t = useTranslations("admin.core.plugins.dev.nav");
  const tCore = useTranslations("core");
  const { form, onSubmit } = useCreateNavPluginAdmin({ data });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{data ? t("edit.title") : t("create.title")}</DialogTitle>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("create.code.label")}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>{t("create.code.desc")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="icon"
            render={({ field }) => (
              <FormItem>
                <FormLabel optional>{t("create.icon.label")}</FormLabel>
                <FormControl>
                  <IconInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button
              disabled={!form.formState.isValid}
              loading={form.formState.isSubmitting}
              type="submit"
            >
              {tCore(data ? "edit" : "create")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
};
