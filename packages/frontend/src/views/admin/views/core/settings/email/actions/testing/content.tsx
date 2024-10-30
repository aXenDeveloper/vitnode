import { AutoForm } from '@/components/form/auto-form';
import { AutoFormInput } from '@/components/form/fields/input';
import { AutoTextArea } from '@/components/form/fields/textarea';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

import { useTestingEmailAdmin } from './hooks/use-testing-email-admin';

export const ContentTestingActionEmailSettingsAdmin = () => {
  const t = useTranslations('admin.core.settings.email.test');
  const { onSubmit, formSchema } = useTestingEmailAdmin();

  return (
    <AutoForm
      fields={[
        {
          id: 'to',
          label: t('to'),
          component: props => <AutoFormInput {...props} type="email" />,
        },
        {
          id: 'subject',
          label: t('subject'),
          component: AutoFormInput,
        },
        {
          id: 'message',
          label: t('message'),
          component: AutoTextArea,
        },
      ]}
      formSchema={formSchema}
      onSubmit={onSubmit}
      submitButton={props => (
        <Button {...props}>{t('send_testing_email')}</Button>
      )}
    />
  );
};
