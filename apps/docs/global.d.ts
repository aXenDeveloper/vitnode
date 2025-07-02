/// <reference types="next-intl" />

import type core from './src/locales/@vitnode/core/en.json';
import type blog from './src/locales/@vitnode/blog/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Messages: typeof core & typeof blog;
  }
}
