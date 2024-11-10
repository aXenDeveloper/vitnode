import { getMiddlewareData } from './api/get-middleware-data';

export const i18nConfigVitNode = async ({
  pathsToMessagesFromPlugins,
  requestLocale,
}: {
  pathsToMessagesFromPlugins: ({
    plugin,
    locale,
  }: {
    locale: string;
    plugin: string;
  }) => Promise<{ default: object }>;
  requestLocale: Promise<string | undefined>;
}) => {
  let locale = await requestLocale;
  let defaultLocale = 'en';

  if (!locale) {
    locale = 'en';
  }

  let plugins: string[] = [];
  try {
    const data = await getMiddlewareData();
    plugins = data.plugins;

    const defaultLanguage = data.languages.find(lang => lang.default);
    defaultLocale = defaultLanguage?.code ?? 'en';
    if (!data.languages.find(lang => lang.code === locale)) {
      locale = defaultLanguage?.code;
    }
  } catch (_) {
    // If the request fails, we will use the default plugins
    plugins = ['core', 'admin'];
  }

  let messages = {};
  for (const plugin of plugins) {
    const message = (
      await pathsToMessagesFromPlugins({
        plugin,
        locale: locale ?? defaultLocale,
      })
    ).default;

    messages = { ...messages, ...message };
  }

  return {
    locale,
    messages,
    timeZone: 'UTC',
  };
};
