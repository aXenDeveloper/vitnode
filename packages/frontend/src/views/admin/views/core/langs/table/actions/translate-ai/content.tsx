import { AutoForm, DependencyType } from '@/components/form/auto-form';
import { AutoFormCombobox } from '@/components/form/fields/combobox';
import { AutoFormSwitch } from '@/components/form/fields/switch';
import { Button } from '@/components/ui/button';
import { useDialog } from '@/components/ui/dialog';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { LanguagesAdminObj } from 'vitnode-shared/admin/language.dto';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const ContentTranslateAiActionTableLangsCoreAdmin = ({
  code,
}: Pick<LanguagesAdminObj, 'code' | 'name'>) => {
  const t = useTranslations('admin.core.langs.actions.translate-ai');
  const tPlugin = useTranslations();
  const tError = useTranslations('core.global.errors');
  const { setOpen } = useDialog();
  const { plugins } = useMiddlewareData();
  const formSchema = z
    .object({
      all: z.boolean().default(true).optional(),
      plugins: z.array(z.enum(plugins as [string, ...string[]])).optional(),
    })
    .refine(data => {
      if (!data.all && !(data.plugins ?? []).length) {
        return false;
      }

      return true;
    });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      await mutationApi({
        code,
        plugins_code: data.all ? [] : (data.plugins ?? []),
      });

      setOpen?.(false);
      toast.success(t('success'));
    } catch (_) {
      toast.error(tError('title'), {
        description: tError('internal_server_error'),
      });
    }
  };

  return (
    <AutoForm
      dependencies={[
        {
          sourceField: 'all',
          type: DependencyType.HIDES,
          targetField: 'plugins',
          when: (all: boolean) => all,
        },
      ]}
      fields={[
        {
          id: 'all',
          label: t('all_plugins.label'),
          description: t('all_plugins.desc'),
          hideOptionalLabel: true,
          component: props => <AutoFormSwitch {...props} />,
        },
        {
          id: 'plugins',
          label: t('plugins.label'),
          hideOptionalLabel: true,
          description: t('plugins.desc'),
          component: props => (
            <AutoFormCombobox
              {...props}
              labels={{
                admin: `${t('admin')} (admin)`,
                ...Object.fromEntries(
                  plugins
                    .filter(item => item !== 'admin')
                    .map(plugin => [
                      plugin,
                      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                      // @ts-expect-error
                      `${tPlugin(`admin_${plugin}.nav.title`)} (${plugin})`,
                    ]),
                ),
              }}
              multiple
            />
          ),
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => <Button {...props}>{t('submit')}</Button>}
    />
  );
};
