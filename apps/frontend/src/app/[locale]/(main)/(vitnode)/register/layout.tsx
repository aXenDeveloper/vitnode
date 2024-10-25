import { TranslationsProvider } from 'vitnode-frontend/components/translations-provider';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <TranslationsProvider namespaces="core.sign_up">
      {children}
    </TranslationsProvider>
  );
}
