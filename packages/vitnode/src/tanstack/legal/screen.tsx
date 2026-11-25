import type { LegalDocumentType } from "@vitnode/api/lib/legal/contract";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileTextIcon } from "lucide-react";
import { useLocale, useTranslations } from "use-intl";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { LegalComparisonBlocks } from "@/views/legal/legal-comparison";
import { LegalDocumentView } from "@/views/legal/legal-document-view";
import { legalBasePath } from "@/views/legal/legal-format";
import { LegalHistory } from "@/views/legal/legal-history";
import {
  legalComparisonQueryOptions,
  legalDocumentQueryOptions,
  legalVersionQueryOptions,
} from "@/views/legal/legal-query";

import { RouteMessages } from "../i18n/route-messages";
import { LEGAL_NAMESPACES } from "./route";

const Shell = ({ children }: { children: React.ReactNode }) => (
  <RouteMessages namespaces={LEGAL_NAMESPACES}>
    <div className="container mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8 md:py-12">
      {children}
    </div>
  </RouteMessages>
);

const NothingPublished = () => {
  const t = useTranslations("core.legal");

  return (
    <Empty className="border" role="status">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{t("empty.title")}</EmptyTitle>
        <EmptyDescription>{t("empty.desc")}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

/** `/terms` and `/privacy`: the effective version and the full history. */
export const LegalDocumentRouteContent = ({
  documentType,
}: {
  documentType: LegalDocumentType;
}) => {
  const locale = useLocale();
  const { data } = useSuspenseQuery(
    legalDocumentQueryOptions({ documentType, locale }),
  );

  return (
    <Shell>
      {data.current ? (
        <LegalDocumentView
          current={data.current}
          document={data.current}
          upcoming={data.upcoming}
        />
      ) : (
        <NothingPublished />
      )}
      {data.history.length > 0 ? (
        <LegalHistory
          activeVersion={data.current?.version}
          history={data.history}
        />
      ) : null}
    </Shell>
  );
};

/** `/terms/versions/:version`: one announced version at its stable address. */
export const LegalVersionRouteContent = ({
  documentType,
  version,
}: {
  documentType: LegalDocumentType;
  version: number;
}) => {
  const locale = useLocale();
  const { data: document } = useSuspenseQuery(
    legalVersionQueryOptions({ documentType, locale, version }),
  );
  const { data: overview } = useSuspenseQuery(
    legalDocumentQueryOptions({ documentType, locale }),
  );

  return (
    <Shell>
      <LegalDocumentView
        current={overview.current}
        document={document}
        upcoming={overview.upcoming}
      />
      <LegalHistory activeVersion={version} history={overview.history} />
    </Shell>
  );
};

/** `/terms/versions/:version/changes`: what changed, block by block. */
export const LegalChangesRouteContent = ({
  documentType,
  from,
  onFromChange,
  version,
}: {
  documentType: LegalDocumentType;
  from?: number;
  onFromChange: (from: number | undefined) => void;
  version: number;
}) => {
  const t = useTranslations("core.legal");
  const locale = useLocale();
  const { data } = useSuspenseQuery(
    legalComparisonQueryOptions({ documentType, from, locale, version }),
  );
  const { data: overview } = useSuspenseQuery(
    legalDocumentQueryOptions({ documentType, locale }),
  );
  const earlier = overview.history.filter(item => item.version < version);
  const base = legalBasePath(documentType);

  return (
    <Shell>
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {t("compare.title", { title: data.to.title, version })}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {data.from
              ? t("compare.desc", { from: data.from.version })
              : t("compare.desc_first")}
          </p>
          <p className="text-sm">
            <Link
              className="text-primary underline-offset-4 hover:underline"
              to={`${base}/versions/${version}`}
            >
              {t("actions.read")} {t("version", { version })}
            </Link>
          </p>
        </header>

        {earlier.length > 1 ? (
          <div className="flex flex-col gap-2 sm:max-w-xs print:hidden">
            <Label htmlFor="legal-compare-from">{t("compare.with")}</Label>
            <NativeSelect
              id="legal-compare-from"
              onChange={event => {
                const value = Number(event.target.value);
                onFromChange(value === earlier[0]?.version ? undefined : value);
              }}
              value={String(data.from?.version ?? "")}
            >
              {earlier.map(item => (
                <NativeSelectOption key={item.id} value={String(item.version)}>
                  {t("version", { version: item.version })}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {data.summary ? (
          <section
            aria-labelledby="legal-changes-summary"
            className="bg-muted/50 flex flex-col gap-2 rounded-xl border p-4"
          >
            <h2 className="font-semibold" id="legal-changes-summary">
              {t("summary_title")}
            </h2>
            <p className="text-sm leading-relaxed text-pretty whitespace-pre-line">
              {data.summary}
            </p>
          </section>
        ) : null}

        {data.from ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {data.locale
              ? t("compare.language_note", { locale: data.locale })
              : t("compare.language_mismatch")}
          </p>
        ) : null}

        <LegalComparisonBlocks comparison={data} />
      </article>
    </Shell>
  );
};
