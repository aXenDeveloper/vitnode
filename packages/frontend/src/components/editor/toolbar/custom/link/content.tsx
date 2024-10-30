import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { useEditorState } from '../../../hooks/use-editor-state';

export const ContentLinkToolbarEditor = ({
  setOpen,
}: {
  setOpen: (open: boolean) => void;
}) => {
  const t = useTranslations('core.global.editor.link');
  const tCore = useTranslations('core.global.errors');
  const { editor } = useEditorState();
  const formSchema = z.object({
    text: z.string().min(1, { message: tCore('required') }),
    href: z.string().min(1, { message: tCore('required') }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text:
        editor.state.doc.textBetween(
          editor.view.state.selection.from,
          editor.view.state.selection.to,
          '',
        ) || '',
      href: editor.getAttributes('link').href ?? '',
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    editor
      .chain()

      .extendMarkRange('link')
      .command(({ dispatch, tr }) => {
        if (!dispatch) return true;

        const { from, to } = tr.selection;
        const displayText = values.text || values.href || '';

        tr.insertText(displayText, from, to);
        tr.addMark(
          from,
          from + displayText.length,
          editor.schema.marks.link.create({ href: values.href }),
        );

        return true;
      })
      .run();

    setOpen(false);
  };

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('text')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="href"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input placeholder={t('href')} type="url" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center gap-2 [&>button]:flex-1 [&>button]:shrink-0">
          <Button
            disabled={!editor.isActive('link')}
            onClick={() => {
              editor.chain().unsetLink().run();
              setOpen(false);
            }}
            size="sm"
            variant="destructiveGhost"
          >
            {t('delete')}
          </Button>
          <Button
            disabled={!form.formState.isValid}
            loading={form.formState.isSubmitting}
            onClick={form.handleSubmit(onSubmit)}
            size="sm"
          >
            {t('insert')}
          </Button>
        </div>
      </form>
    </Form>
  );
};
