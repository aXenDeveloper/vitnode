import type plugin from './src/locales/en.json';
import type core from '@vitnode/core/locales/en.json';

type Messages = typeof plugin & typeof core;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
