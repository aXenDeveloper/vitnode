import { VitNodePlugin } from './plugin.types';

export interface VitNodeConfig<AppLocales extends string[] = string[]> {
  debug?: boolean;
  i18n: {
    defaultLocale: AppLocales[number];
    localePrefix?: 'always' | 'as-needed' | 'never';
    locales: AppLocales;
  };
  metadata: {
    shortTitle?: string;
    title: string;
  };
  plugins: VitNodePlugin[];
}

export function getVitNodeConfig<AppLocales extends string[]>(
  args: VitNodeConfig<AppLocales>,
) {
  return args;
}
