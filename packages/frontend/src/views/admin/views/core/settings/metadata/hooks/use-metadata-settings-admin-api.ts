import { fetcherClient } from '@/api/fetcher-client';
import { convertColor, getHSLFromString } from '@/helpers/colors';
import { CONFIG } from '@/helpers/config-with-env';
import { zodFile } from '@/helpers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ShowMetadataAdminBody,
  ShowMetadataAdminObj,
} from 'vitnode-shared/admin/settings/metadata.dto';
import { ManifestDisplay } from 'vitnode-shared/admin/settings/metadata.enum';
import { z } from 'zod';

import { revalidateAllApi } from '../../../diagnostic/actions/clear_cache/hooks/revalidate-all-api';
import { ContentMetadataSettingsAdmin } from '../content';

export const useMetadataSettingsAdminApi = ({
  start_url,
  theme_color,
  background_color,
  display,
  icon,
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
    icon: zodFile
      .nullable()
      .default(icon ?? null)
      .optional(),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const themeColor = getHSLFromString(values.theme_color);
    const backgroundColor = getHSLFromString(values.background_color);

    try {
      const formData = new FormData();
      formData.append('display', values.display);
      formData.append('start_url', values.start_url);
      if (themeColor) {
        formData.append('theme_color', `#${convertColor.hslToHex(themeColor)}`);
      }
      if (backgroundColor) {
        formData.append(
          'background_color',
          `#${convertColor.hslToHex(backgroundColor)}`,
        );
      }
      if (values.icon && values.icon instanceof File) {
        formData.append('icon', values.icon);
      } else if (values.icon === null) {
        formData.append('remove_icon', 'true');
      }

      await fetcherClient<ShowMetadataAdminObj, ShowMetadataAdminBody>({
        url: '/admin/settings/metadata',
        method: 'PUT',
        body: formData,
      });
      await revalidateAllApi();
      toast.success(t('saved_success'));
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return { formSchema, onSubmit };
};
