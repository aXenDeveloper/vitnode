import { fetcher } from '@/api/fetcher';
import { RevalidateTagEnum } from '@/api/revalidate-tags';
import { DateFormat } from '@/components/date-format';
import { ReadOnlyEditor } from '@/components/editor/read-only/read-only';
import { getTextLang } from '@/hooks/use-text-lang';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Legal } from 'vitnode-shared/legal.dto';

const getData = async (code: string) => {
  try {
    const { data } = await fetcher<Legal>({
      url: `/core/legal/${code}`,
      method: 'GET',
      cache: 'force-cache',
      next: {
        tags: [`${RevalidateTagEnum.Core_Terms_Show}--${code}`],
      },
    });

    return data;
  } catch (err) {
    const error = err as Error;

    if (error.message.includes('404')) {
      notFound();
    }

    throw error;
  }
};

interface Props {
  params: Promise<{ code: string }>;
}

export const generateMetadataItemLegal = async ({
  params,
}: Props): Promise<Metadata> => {
  const { code } = await params;
  const [{ convertText }, { title }] = await Promise.all([
    getTextLang(),
    getData(code),
  ]);

  return {
    title: convertText(title),
  };
};

export const ItemLegalView = async ({ params }: Props) => {
  const { code } = await params;
  const [t, { convertText }, { updated_at, title, content }] =
    await Promise.all([
      getTranslations('core.legal'),
      getTextLang(),
      getData(code),
    ]);

  return (
    <div className="container my-24 max-w-5xl space-y-24">
      <div className="grid justify-center">
        <div className="flex max-w-xl flex-col gap-6 text-center">
          <h1 className="text-3xl font-semibold">{convertText(title)}</h1>
          <p className="text-muted-foreground text-sm">
            {t.rich('last_updated', {
              date: () => <DateFormat date={updated_at} />,
            })}
          </p>
        </div>
      </div>

      <ReadOnlyEditor
        className="[&_p]:text-muted-foreground [&_strong]:text-foreground"
        value={content}
      />
    </div>
  );
};
