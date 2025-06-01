import { useTranslations } from 'next-intl';

export const Test = () => {
  const t = useTranslations('blog');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>This is a test page.</p>
    </div>
  );
};
