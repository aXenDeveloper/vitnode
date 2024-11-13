import { FilesInputValue } from '@/components/ui/file-input';
import { zodFiles } from '@/helpers/zod';
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import * as z from 'zod';

export enum ThemeEditorIds {
  dark = 'vitnode_logo_dark',
  light = 'vitnode_logo_light',
  mobile_dark = 'vitnode_logo_mobile_dark',
  mobile_light = 'vitnode_logo_mobile_light',
}

interface Args {
  form: UseFormReturn<{
    logos: {
      dark?: FilesInputValue[];
      light?: FilesInputValue[];
      mobile_dark?: FilesInputValue[];
      mobile_light?: FilesInputValue[];
      mobile_width: number;
      text: string;
      width: number;
    };
  }>;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  updateLogo: (args: { file: FilesInputValue[]; id: ThemeEditorIds }) => void;
}

export const ThemeEditorContext = React.createContext<Args>({} as Args);

export const useThemeEditor = () => {
  const hook = React.useContext(ThemeEditorContext);
  const formSchema = z.object({
    logos: z.object({
      light: zodFiles.default([]).optional(),
      dark: zodFiles.default([]).optional(),
      width: z.number(),
      mobile_light: zodFiles.default([]).optional(),
      mobile_dark: zodFiles.default([]).optional(),
      mobile_width: z.number(),
      text: z.string().min(1).max(100),
    }),
  });

  return { ...hook, formSchema };
};
