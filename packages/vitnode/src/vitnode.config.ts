import { ThemeProvider } from 'next-themes';

import { BuildPluginReturn } from './lib/plugin';

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
  plugins: BuildPluginReturn[];
  theme: Omit<
    React.ComponentProps<typeof ThemeProvider>,
    'attribute' | 'disableTransitionOnChange' | 'enableSystem'
  >;
}

export function buildConfig<AppLocales extends string[]>(
  args: VitNodeConfig<AppLocales>,
): VitNodeConfig<AppLocales> {
  return {
    ...args,
    i18n: {
      ...args.i18n,
      localePrefix: args.i18n.localePrefix ?? 'as-needed',
    },
  };
}

export const handleRequestConfig = async ({
  requestLocale,
  vitNodeConfig,
}: {
  requestLocale: Promise<string | undefined>;
  vitNodeConfig: VitNodeConfig;
}) => {
  const reqLocale = await requestLocale;
  const locale =
    reqLocale && `${vitNodeConfig.i18n.locales}`.includes(reqLocale)
      ? reqLocale
      : vitNodeConfig.i18n.defaultLocale;

  return {
    locale,
    messages: (await import(`@/plugins/core/langs/${locale}.json`)).default,
  };
};
