import type core from '@/plugins/core/langs/en.json';

type Messages = typeof core;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
