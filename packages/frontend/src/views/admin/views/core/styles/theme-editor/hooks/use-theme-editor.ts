import { FilesInputValue } from '@/components/ui/file-input';
import { zodFile } from '@/helpers/zod';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

export enum ThemeEditorIds {
  dark = 'vitnode_logo_dark',
  light = 'vitnode_logo_light',
  mobile_dark = 'vitnode_logo_mobile_dark',
  mobile_light = 'vitnode_logo_mobile_light',
}

interface Args {
  form: UseFormReturn<FormValues>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onSubmit: (args: FormValues) => void;
  updateLogo: (args: {
    file: FilesInputValue | null;
    id: ThemeEditorIds;
  }) => void;
}

interface FormValues {
  logos: {
    dark?: FilesInputValue | null;
    light?: FilesInputValue | null;
    mobile_dark?: FilesInputValue | null;
    mobile_light?: FilesInputValue | null;
    mobile_width: number;
    text: string;
    width: number;
  };
}

export const ThemeEditorContext = React.createContext<Args>({} as Args);

export const useThemeEditor = () => {
  const hook = React.useContext(ThemeEditorContext);
  const formSchema = z.object({
    logos: z.object({
      light: zodFile.nullable().default(null).optional(),
      dark: zodFile.nullable().default(null).optional(),
      width: z.number(),
      mobile_light: zodFile.nullable().default(null).optional(),
      mobile_dark: zodFile.nullable().default(null).optional(),
      mobile_width: z.number(),
      text: z.string().min(1).max(100),
    }),
  });

  return { ...hook, formSchema };
};
