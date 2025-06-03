import type plugin from './src/locales/en.json';

type Messages = typeof plugin;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
