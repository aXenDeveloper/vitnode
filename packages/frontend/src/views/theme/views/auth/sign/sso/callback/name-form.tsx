import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { Button } from '@/components/ui/button';
import { CardDescription } from '@/components/ui/card';
import { removeSpecialCharacters } from '@/helpers/special-characters';
import { nameRegex } from '@/hooks/sign/up/use-sign-up-view';
import { LogIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { SSOCallbackAuthObj } from 'vitnode-shared/auth/sso.dto';
import * as z from 'zod';

import { mutationApi } from './hooks/mutation-api';

export const NameFormCallbackSSO = ({
  access_token,
  provider_id,
  provider,
}: SSOCallbackAuthObj) => {
  const t = useTranslations('core.sign_in.sso_first_login');
  const tSignUp = useTranslations('core.sign_up');
  const tCore = useTranslations('core.global');
  const formSchema = z.object({
    name: z
      .string()
      .min(3, {
        message: tCore('errors.min_length', { length: 3 }),
      })
      .max(32, {
        message: tCore('errors.max_length', { length: 32 }),
      })
      .refine(value => nameRegex.test(value), {
        message: tSignUp('name.invalid'),
      })
      .default(''),
  });

  const onSubmit = async (
    values: z.infer<typeof formSchema>,
    form: UseFormReturn<z.infer<typeof formSchema>>,
  ) => {
    const mutation = await mutationApi({
      ...values,
      provider_id,
      provider,
      access_token,
    });
    if (!mutation?.message) return;

    if (mutation.message === 'NAME_ALREADY_EXISTS') {
      form.setError(
        'name',
        {
          type: 'manual',
          message: tSignUp('name.already_exists'),
        },
        {
          shouldFocus: true,
        },
      );

      return;
    }

    toast.error(tCore('errors.title'), {
      description: tCore('errors.internal_server_error'),
    });
  };

  return (
    <div className="container max-w-md py-10">
      <div className="mb-10 space-y-2 text-center">
        <h1 className="text-3xl font-semibold leading-none tracking-tight">
          {t('title')}
        </h1>
        <CardDescription>{t('desc')}</CardDescription>
      </div>

      <AutoForm
        fields={[
          {
            id: 'name',
            component: props => {
              const value: string = props.field.value ?? '';

              return (
                <>
                  <AutoFormInput {...props} className="bg-card shadow-sm" />
                  {value.length > 0 && (
                    <span className="text-muted-foreground block max-w-md truncate text-sm">
                      {tSignUp.rich('name.your_id', {
                        id: () => (
                          <span className="text-foreground font-medium">
                            {removeSpecialCharacters(value)}
                          </span>
                        ),
                      })}
                    </span>
                  )}
                </>
              );
            },
            label: tSignUp('name.label'),
            description: tSignUp('name.desc'),
          },
        ]}
        formSchema={formSchema}
        onSubmit={onSubmit}
        submitButton={props => (
          <Button {...props} className="w-full">
            <LogIn />
            {tSignUp('submit')}
          </Button>
        )}
      />
    </div>
  );
};
