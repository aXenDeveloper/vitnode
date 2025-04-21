import { BuildPluginReturn } from './api/lib/plugin';
import { PluginConfigReturn } from './plugin.config';

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
  plugins: PluginConfigReturn[];
  pluginsNew: BuildPluginReturn[];
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
