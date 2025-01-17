import { getGroupsShortApi } from '@/api/get-groups-short-api';
import { AutoForm } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormCombobox } from '@/components/form/fields/combobox';
import { AutoFormInput } from '@/components/form/fields/input';
import { useDialog } from '@/components/ui/dialog';
import { GroupFormat } from '@/components/ui/user/group-format';
import { zodComboBoxWithFetcher } from '@/helpers/zod';
import { nameRegex } from '@/views/theme/views/auth/sign/up/hooks/use-sign-up-view';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';
import { z } from 'zod';

import { mutationApi } from './mutation-api';

export const EditActionUserMembersAdmin = ({
  name,
  email,
  newsletter,
  id,
  group,
}: Pick<
  UserMembersAdmin,
  'email' | 'group' | 'id' | 'name' | 'newsletter'
>) => {
  const t = useTranslations('admin.members.users.item.edit');
  const tSignUp = useTranslations('core.sign_up');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();

  const formSchema = z.object({
    name: z
      .string()
      .min(3, tCore('min_length', { length: 3 }))
      .max(32, tCore('max_length', { length: 32 }))
      .refine(value => nameRegex.test(value), tSignUp('name.invalid'))
      .default(name),
    email: z.string().email(tSignUp('email_invalid')).default(email),
    newsletter: z.boolean().default(newsletter).optional(),
    group: zodComboBoxWithFetcher.default([
      {
        key: group.id.toString(),
        value: group.name,
      },
    ]),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const mutation = await mutationApi({
      id,
      ...values,
      group_id: +values.group[0].key,
    });

    if (!mutation?.message) {
      setOpen?.(false);
      toast.success(t('success'), {
        description: values.name,
      });

      return;
    }

    if (mutation.message === 'EMAIL_ALREADY_EXISTS') {
      form.setError('email', {
        message: tSignUp('email.already_exists'),
      });

      return;
    }

    toast.error(tCore('title'), {
      description: tCore('internal_server_error'),
    });
  };

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          label: tSignUp('name.label'),
          component: AutoFormInput,
          description: tSignUp('name.desc'),
        },
        {
          id: 'email',
          label: tSignUp('email.label'),
          component: props => <AutoFormInput {...props} type="email" />,
        },
        {
          id: 'group',
          label: t('group'),
          component: props => (
            <AutoFormCombobox
              {...props}
              withFetcher={{
                queryKey: 'groups_short_api',
                search: true,
                queryFn: async ({ search }) => {
                  try {
                    const mutation = await getGroupsShortApi({ search });

                    return (mutation.edges ?? [])
                      .filter(item => !item.guest)
                      .map(item => ({
                        key: item.id.toString(),
                        value: item.name,
                        valueWithFormatting: <GroupFormat group={item} />,
                      }));
                  } catch (_) {
                    toast.error(tCore('title'), {
                      description: tCore('internal_server_error'),
                    });

                    return [];
                  }
                },
              }}
            />
          ),
        },
        {
          id: 'newsletter',
          label: tSignUp('newsletter.label'),
          description: tSignUp('newsletter.desc'),
          component: AutoFormCheckbox,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
    />
  );
};
