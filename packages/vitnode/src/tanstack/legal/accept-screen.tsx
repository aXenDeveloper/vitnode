import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { CheckIcon, LogOutIcon, ScrollTextIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "use-intl";

import { RichTextContent } from "@/components/rich-text/rich-text-content";
import { Button } from "@/components/ui/button";
import { LegalComparisonBlocks } from "@/views/legal/legal-comparison";
import {
  acceptTerms,
  legalComparisonQueryOptions,
  legalLinksQueryOptions,
  legalVersionQueryOptions,
} from "@/views/legal/legal-query";

import type { LegalAcceptRouteData } from "./accept-route";

import { useSignOutAction } from "../auth/actions";
import { invalidateSession } from "../auth/session-query";
import { RouteMessages } from "../i18n/route-messages";
import { legalAcceptDestination } from "./accept-route";
import { LEGAL_NAMESPACES } from "./route";

const linkClass = "text-primary underline-offset-4 hover:underline";

const ChangesSinceAccepted = ({
  from,
  version,
}: {
  from: number;
  version: number;
}) => {
  const t = useTranslations("core.legal");
  const locale = useLocale();
  const { data } = useSuspenseQuery(
    legalComparisonQueryOptions({
      documentType: "terms",
      from,
      locale,
      version,
    }),
  );

  return (
    <section
      aria-labelledby="legal-gate-changes"
      className="flex flex-col gap-4"
    >
      <h2
        className="text-lg font-semibold text-balance"
        id="legal-gate-changes"
      >
        {t("gate.since", { version: from })}
      </h2>
      {data.summary ? (
        <p className="bg-muted/50 rounded-xl border p-4 text-sm leading-relaxed text-pretty whitespace-pre-line">
          {data.summary}
        </p>
      ) : null}
      <LegalComparisonBlocks comparison={data} />
    </section>
  );
};

/**
 * The dedicated page a member who owes Terms acceptance lands on: what
 * changed since the version they last accepted (or the full text), links to
 * the documents and their data controls, and exactly two actions - accept
 * this version or sign out. There is no "later".
 */
export const LegalAcceptRouteContent = ({
  lastAcceptedVersion,
  returnTo,
  title,
  version,
  versionId,
}: LegalAcceptRouteData & { returnTo?: string }) => {
  const t = useTranslations("core.legal");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const router = useRouter();
  const signOut = useSignOutAction();
  const [pending, setPending] = React.useState<"accept" | "sign_out" | null>(
    null,
  );
  const { data: document } = useSuspenseQuery(
    legalVersionQueryOptions({ documentType: "terms", locale, version }),
  );
  const { data: links } = useSuspenseQuery(legalLinksQueryOptions(locale));
  const wording =
    document.acceptanceLabel ||
    t("acceptance.default_wording", { title: document.title, version });

  const onAccept = async () => {
    setPending("accept");
    try {
      const result = await acceptTerms({ locale: document.locale, versionId });
      if (result.kind === "changed") {
        toast.warning(t("gate.toast.changed.title"), {
          description: t("gate.toast.changed.desc"),
        });
        await invalidateSession(queryClient);
        await router.invalidate();

        return;
      }
      if (result.kind === "error") {
        toast.error(t("gate.toast.error.title"), {
          description: t("gate.toast.error.desc"),
        });

        return;
      }

      toast.success(t("gate.toast.accepted.title"), {
        description: t("gate.toast.accepted.desc", { version }),
      });
      await invalidateSession(queryClient);
      await router.navigate({
        replace: true,
        to: legalAcceptDestination(returnTo),
      });
    } finally {
      setPending(null);
    }
  };

  const onSignOut = async () => {
    setPending("sign_out");
    try {
      await signOut();
      await router.navigate({ replace: true, to: "/" });
    } finally {
      setPending(null);
    }
  };

  return (
    <RouteMessages namespaces={LEGAL_NAMESPACES}>
      <div className="container mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 md:py-12">
        <header className="flex flex-col gap-3">
          <span
            aria-hidden="true"
            className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl"
          >
            <ScrollTextIcon className="size-6" />
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            {title}
          </h1>
          <p className="text-muted-foreground leading-relaxed text-pretty">
            {lastAcceptedVersion === null
              ? t("gate.desc_first")
              : t("gate.desc", { version })}
          </p>
        </header>

        {lastAcceptedVersion === null ? (
          <section
            aria-labelledby="legal-gate-full-text"
            className="flex flex-col gap-3"
          >
            <h2
              className="text-lg font-semibold text-balance"
              id="legal-gate-full-text"
            >
              {document.title} · {t("version", { version })}
            </h2>
            <div
              className="max-h-96 overflow-y-auto rounded-xl border p-4"
              lang={document.locale}
              // A focusable scroll region, so keyboard users can scroll it.
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
            >
              <RichTextContent
                className="leading-relaxed"
                content={document.body}
              />
            </div>
          </section>
        ) : (
          <ChangesSinceAccepted from={lastAcceptedVersion} version={version} />
        )}

        <nav aria-label={t("gate.title_first")}>
          <ul className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li>
              <Link className={linkClass} to={`/terms/versions/${version}`}>
                {t("gate.links.full")}
              </Link>
            </li>
            {document.previousVersion === null ? null : (
              <li>
                <Link
                  className={linkClass}
                  to={`/terms/versions/${version}/changes`}
                >
                  {t("gate.links.changes")}
                </Link>
              </li>
            )}
            {links.privacy ? (
              <li>
                <Link className={linkClass} to="/privacy">
                  {t("gate.links.privacy")}
                </Link>
              </li>
            ) : null}
            <li>
              <Link className={linkClass} to="/settings/privacy">
                {t("gate.links.data")}
              </Link>
            </li>
          </ul>
        </nav>

        <footer className="bg-muted/50 flex flex-col gap-4 rounded-xl border p-4">
          <p className="leading-relaxed text-pretty" lang={document.locale}>
            {wording}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={pending === "sign_out"}
              isLoading={pending === "accept"}
              onClick={onAccept}
            >
              <CheckIcon aria-hidden="true" />
              {t("gate.accept", { version: t("version_short", { version }) })}
            </Button>
            <Button
              disabled={pending === "accept"}
              isLoading={pending === "sign_out"}
              onClick={onSignOut}
              variant="outline"
            >
              <LogOutIcon aria-hidden="true" />
              {t("gate.sign_out")}
            </Button>
          </div>
        </footer>
      </div>
    </RouteMessages>
  );
};
