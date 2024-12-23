import type core from '../../apps/frontend/src/plugins/core/langs/en.json';
import type admin from '../../apps/frontend/src/plugins/admin/langs/en.json';
import type welcome from '../../apps/frontend/src/plugins/welcome/langs/en.json';

type Messages = typeof core & typeof admin & typeof welcome;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
