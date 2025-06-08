/// <reference types="next-intl" />

import type plugin from './src/locales/en.json';
import type core from '@vitnode/core/locales/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof plugin & typeof core;
  }
}
