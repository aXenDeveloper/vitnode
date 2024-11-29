import { convertColor, getHSLFromString } from '@/helpers/colors';
import { CONFIG } from '@/helpers/config-with-env';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ManifestDisplay } from 'vitnode-shared/admin/settings/metadata.enum';
import * as z from 'zod';

import { ContentMetadataSettingsAdmin } from '../content';
import { mutationApi } from './mutation-api';

export const useMetadataSettingsAdminApi = ({
  start_url,
  theme_color,
  background_color,
  display,
}: React.ComponentProps<typeof ContentMetadataSettingsAdmin>) => {
  const t = useTranslations('core.global');
  const themeColor = convertColor.hexToHSL(theme_color);
  const backgroundColor = convertColor.hexToHSL(background_color);

  const formSchema = z.object({
    display: z.nativeEnum(ManifestDisplay).default(display),
    start_url: z
      .string()
      .min(1)
      .default(start_url.replace(`${CONFIG.frontend_url}/en`, '')),
    theme_color: z
      .string()
      .default(
        themeColor
          ? `hsl(${themeColor.h}, ${themeColor.s}%, ${themeColor.l}%)`
          : '',
      ),
    background_color: z
      .string()
      .default(
        backgroundColor
          ? `hsl(${backgroundColor.h}, ${backgroundColor.s}%, ${backgroundColor.l}%)`
          : '',
      ),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const themeColor = getHSLFromString(values.theme_color);
    const backgroundColor = getHSLFromString(values.background_color);

    try {
      await mutationApi({
        ...values,
        theme_color: themeColor ? `#${convertColor.hslToHex(themeColor)}` : '',
        background_color: backgroundColor
          ? `#${convertColor.hslToHex(backgroundColor)}`
          : '',
      });

      toast.success(t('saved_success'));
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return { formSchema, onSubmit };
};
