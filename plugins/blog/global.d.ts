import type plugin from './src/langs/en.json';
import type core from '@vitnode/core/langs/en.json';

type Messages = typeof plugin & typeof core;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
