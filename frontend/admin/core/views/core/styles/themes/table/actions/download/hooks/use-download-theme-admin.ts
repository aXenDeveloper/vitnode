import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

import { mutationApi } from './mutation-api';
import { increaseVersionString } from '@/functions/increase-version-string';
import { useDialog } from '@/components/ui/dialog';
import { CONFIG } from '@/config';

interface Args {
  id: number;
  version: string;
  version_code: number;
}

export const useDownloadThemeAdmin = ({ id, version, version_code }: Args) => {
  const t = useTranslations('core');
  const { setOpen } = useDialog();
  const formSchema = z.object({
    type: z.enum(['rebuild', 'new_version']),
    version: z.string(),
    version_code: z.coerce.number().min(version_code ? version_code + 1 : 10000)
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'rebuild',
      version: version ? increaseVersionString(version) : '1.0.0',
      version_code: version_code ? version_code + 1 : 10000
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const mutation = await mutationApi({
      id,
      version: values.version,
      versionCode: values.version_code
    });

    if (mutation.error || !mutation.data) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error')
      });

      return;
    }

    setOpen(false);

    window.location.href = `${CONFIG.client_graphql_url}/files/${mutation.data.core_themes__admin__download}`;
  };

  return { form, onSubmit };
};
