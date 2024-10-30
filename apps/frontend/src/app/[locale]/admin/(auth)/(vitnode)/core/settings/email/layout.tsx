import { TranslationsProvider } from 'vitnode-frontend/components/translations-provider';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TranslationsProvider namespaces="admin.core.settings.email">
      {children}
    </TranslationsProvider>
  );
}
