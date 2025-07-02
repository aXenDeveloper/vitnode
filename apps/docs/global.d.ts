/// <reference types="next-intl" />

import type core from './src/locales/@vitnode/core/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof core;
  }
}
