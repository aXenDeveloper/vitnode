'use client';

import { FilesInputValue } from '@/components/ui/file-input';
import { cn } from '@/helpers/classnames';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

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
  const { formSchema } = useThemeEditor();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      logos: {
        text: '',
        width: 20,
        mobile_width: 5,
      },
    },
  });
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // const stateLogos = {
  //   light: form.watch('logos.light'),
  //   dark: form.watch('logos.dark'),
  //   mobile_light: form.watch('logos.mobile_light'),
  //   mobile_dark: form.watch('logos.mobile_dark'),
  // };

  const updateLogo = ({
    file: files,
    id,
  }: {
    file: FilesInputValue[];
    id: ThemeEditorIds;
  }) => {
    const file = files[0];
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
        'dark:hidden': stateLogos.dark?.length,
        'hidden sm:block': stateLogos.mobile_light?.length
          ? stateLogos.mobile_light
          : stateLogos.mobile_dark,
      }),
      vitnode_logo_dark: cn(commonClassName, {
        'hidden dark:block': stateLogos.light,
        'hidden sm:block': !stateLogos.light,
        'dark:hidden dark:sm:block': stateLogos.mobile_dark?.length
          ? stateLogos.mobile_dark
          : stateLogos.mobile_light,
      }),
      vitnode_logo_mobile_light: cn(commonClassName, {
        'block sm:hidden': stateLogos.light?.length
          ? stateLogos.light
          : stateLogos.dark,

        'dark:hidden': stateLogos.mobile_dark,
      }),
      vitnode_logo_mobile_dark: cn(commonClassName, {
        'block sm:hidden dark:block dark:sm:hidden': stateLogos.light?.length
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

  return (
    <ThemeEditorContext.Provider value={{ form, iframeRef, updateLogo }}>
      {children}
    </ThemeEditorContext.Provider>
  );
};
