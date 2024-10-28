import { AutoForm } from '@/components/form/auto-form';
import { AutoFormCheckbox } from '@/components/form/fields/checkbox';
import { AutoFormInput } from '@/components/form/fields/input';
import { useDialog } from '@/components/ui/dialog';
import { nameRegex } from '@/hooks/sign/up/use-sign-up-view';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { UserMembersAdmin } from 'vitnode-shared/admin/members/users.dto';
import * as z from 'zod';

import { mutationApi } from './mutation-api';

export const EditActionUserMembersAdmin = ({
  name,
  email,
  newsletter,
  id,
}: Pick<UserMembersAdmin, 'email' | 'id' | 'name' | 'newsletter'>) => {
  const t = useTranslations('admin.members.users.item.edit');
  const tSignUp = useTranslations('core.sign_up');
  const tCore = useTranslations('core.global.errors');
  const { setOpen } = useDialog();

  const formSchema = z.object({
    name: z
      .string()
      .min(3, {
        message: tCore('min_length', { length: 3 }),
      })
      .max(32, {
        message: tCore('max_length', { length: 32 }),
      })
      .refine(value => nameRegex.test(value), {
        message: tSignUp('name.invalid'),
      })
      .default(name),
    email: z
      .string()
      .email({
        message: tSignUp('email_invalid'),
      })
      .default(email),
    newsletter: z.boolean().default(newsletter).optional(),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    try {
      await mutationApi();

      setOpen?.(false);
      toast.success(t('success'), {
        description: values.name,
      });
    } catch (e) {
      const error = e as Error;
      if (error.message.includes('EMAIL_ALREADY_EXISTS')) {
        form.setError('email', {
          message: tSignUp('email.already_exists'),
        });

        return;
      }

      toast.error(tCore('title'), {
        description: tCore('internal_server_error'),
      });
    }

    // const mutation = await mutationApi({
    //   id,
    //   ...values,
    //   newsletter: values.newsletter ?? false,
    // });
  };

  return (
    <AutoForm
      fields={[
        {
          id: 'name',
          component: AutoFormInput,
          description: tSignUp('name.desc'),
        },
        {
          id: 'email',
          component: props => <AutoFormInput {...props} type="email" />,
          label: tSignUp('email.label'),
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
