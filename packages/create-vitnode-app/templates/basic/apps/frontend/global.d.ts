import type core from '@/plugins/core/langs/en.json';
import type admin from '@/plugins/admin/langs/en.json';
import type welcome from '@/plugins/welcome/langs/en.json';

type Messages = typeof core & typeof admin & typeof welcome;

declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
