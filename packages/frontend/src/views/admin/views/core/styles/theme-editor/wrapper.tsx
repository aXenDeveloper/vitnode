'use client';

import { fetcherClient } from '@/api/fetcher-client';
import { FilesInputValue } from '@/components/ui/file-input';
import { cn } from '@/helpers/classnames';
import { useMiddlewareData } from '@/hooks/use-middleware-data';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  EditThemeEditorStylesAdminBody,
  EditThemeEditorStylesAdminObj,
} from 'vitnode-shared/admin/styles/theme-editor.dto';
import * as z from 'zod';

import { revalidateAllApi } from '../../diagnostic/actions/clear_cache/hooks/revalidate-all-api';
import {
  ThemeEditorContext,
  ThemeEditorIds,
  useThemeEditor,
} from './hooks/use-theme-editor';

export const WrapperThemeEditorAdmin = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const t = useTranslations('core.global');
  const { logos } = useMiddlewareData();
  const { formSchema } = useThemeEditor();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      logos: {
        text: logos.text,
        width: logos.width,
        mobile_width: logos.mobile_width,
        light: logos.logo_light,
        mobile_light: logos.mobile_logo_light,
        dark: logos.logo_dark,
        mobile_dark: logos.mobile_logo_dark,
      },
    },
  });
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const updateLogo = ({
    file,
    id,
  }: {
    file: FilesInputValue | null;
    id: ThemeEditorIds;
  }) => {
    const iFrame = iframeRef?.current?.contentWindow?.document;
    const logoElement = iFrame?.querySelector<HTMLElement>('#vitnode_logo');
    if (!logoElement) return;

    const stateLogos = {
      light: form.watch('logos.light'),
      dark: form.watch('logos.dark'),
      mobile_light: form.watch('logos.mobile_light'),
      mobile_dark: form.watch('logos.mobile_dark'),
    };

    const commonClassName = 'w-[--logo-mobile-width] sm:w-[--logo-width]';
    const classNames = {
      vitnode_logo_light: cn(commonClassName, {
        'dark:hidden': stateLogos.dark,
        'hidden sm:block': stateLogos.mobile_light
          ? stateLogos.mobile_light
          : stateLogos.mobile_dark,
      }),
      vitnode_logo_dark: cn(commonClassName, {
        'hidden dark:block': stateLogos.light,
        'hidden sm:block': !stateLogos.light,
        'dark:hidden dark:sm:block': stateLogos.mobile_dark
          ? stateLogos.mobile_dark
          : stateLogos.mobile_light,
      }),
      vitnode_logo_mobile_light: cn(commonClassName, {
        'block sm:hidden': stateLogos.light
          ? stateLogos.light
          : stateLogos.dark,

        'dark:hidden': stateLogos.mobile_dark,
      }),
      vitnode_logo_mobile_dark: cn(commonClassName, {
        'block sm:hidden dark:block dark:sm:hidden': stateLogos.light
          ? stateLogos.light
          : stateLogos.dark,
        'hidden dark:block': form.watch('logos.mobile_light'),
      }),
    };

    for (const keyFromFor in ThemeEditorIds) {
      const key = ThemeEditorIds[keyFromFor] as ThemeEditorIds;
      const element = iFrame?.querySelector<HTMLImageElement>(`img#${key}`);

      if (key === id) {
        if (!file || !(file instanceof File)) {
          element?.remove();
        } else {
          if (element) {
            element.srcset = URL.createObjectURL(file);
          } else {
            const img = document.createElement('img');
            img.id = key;
            img.srcset = URL.createObjectURL(file);
            img.className = classNames[key];
            img.alt = '';

            logoElement.appendChild(img);
          }
        }
      }

      // Update rest of the logos
      if (element) {
        switch (key) {
          case ThemeEditorIds.dark:
            element.className = classNames.vitnode_logo_dark;
            break;
          case ThemeEditorIds.light:
            element.className = classNames.vitnode_logo_light;
            break;
          case ThemeEditorIds.mobile_dark:
            element.className = classNames.vitnode_logo_mobile_dark;
            break;
          case ThemeEditorIds.mobile_light:
            element.className = classNames.vitnode_logo_mobile_light;
            break;
        }
      }
    }

    // Check if there are no logos, replace the logo with text
    let hasLogos = false;
    for (const keyFromFor in ThemeEditorIds) {
      const key = ThemeEditorIds[keyFromFor] as ThemeEditorIds;
      const element = iFrame?.querySelector<HTMLImageElement>(`img#${key}`);
      if (element) {
        hasLogos = true;
        break;
      }
    }

    const textElement =
      iFrame?.querySelector<HTMLElement>('#vitnode_logo_text');

    if (hasLogos) {
      textElement?.remove();

      return;
    }
    if (textElement) return;

    const span = document.createElement('span');
    span.id = 'vitnode_logo_text';
    span.textContent = form.watch('logos.text');
    span.className =
      'text-foreground inline-block whitespace-nowrap text-xl font-bold';
    logoElement.appendChild(span);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const formData = new FormData();
    const { logos } = values;

    // Add basic logo settings
    formData.append('mobile_width', logos.mobile_width.toString());
    formData.append('text', logos.text);
    formData.append('width', logos.width.toString());

    // Handle logo files
    const logoTypes = {
      dark: 'logo_dark',
      light: 'logo_light',
      mobile_dark: 'mobile_logo_dark',
      mobile_light: 'mobile_logo_light',
    } as const;

    const logosToDelete: string[] = [];

    Object.entries(logoTypes).forEach(([key, formKey]) => {
      const logo = logos[key as keyof typeof logoTypes];
      if (logo) {
        if (logo instanceof File) {
          formData.append(formKey, logo);
        }
      } else {
        logosToDelete.push(formKey);
      }
    });

    formData.append('delete_logos', logosToDelete.toString());

    try {
      await fetcherClient<
        EditThemeEditorStylesAdminObj,
        EditThemeEditorStylesAdminBody
      >({
        url: '/admin/styles/theme-editor',
        method: 'PUT',
        body: formData,
      });

      await revalidateAllApi();
      toast.success(t('saved_success'));
      form.reset(values);
    } catch (_) {
      toast.error(t('errors.title'), {
        description: t('errors.internal_server_error'),
      });
    }
  };

  return (
    <ThemeEditorContext.Provider
      value={{ form, iframeRef, updateLogo, onSubmit }}
    >
      {children}
    </ThemeEditorContext.Provider>
  );
};
