import type core from '../../apps/web/src/plugins/core/langs/en.json';

type Messages = typeof core;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
