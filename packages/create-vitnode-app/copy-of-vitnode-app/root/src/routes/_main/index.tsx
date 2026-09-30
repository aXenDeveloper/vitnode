import type { RegisteredRouter } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { Messages } from "use-intl";

import { createFileRoute, Link } from "@tanstack/react-router";
import { LogoVitNode } from "@vitnode/core/components/logo-vitnode";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  VITNODE_DOCS_URL,
  VITNODE_WEBSITE_URL,
} from "@vitnode/core/lib/docs-links";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import {
  GLOBAL_NAMESPACE,
  intlQueryOptions,
  RouteMessages,
} from "@vitnode/core/tanstack/i18n";
import { pageHead } from "@vitnode/core/tanstack/metadata";
import { cn } from "cn";
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";
import { createTranslator, useTranslations } from "use-intl";

const REGISTER_HREF = "/register";
const ADMIN_HREF = "/admin";
const HOME_NAMESPACES = [GLOBAL_NAMESPACE, "app.home"] as const;

export const Route = createFileRoute("/_main/")({
  loader: async ({ context: { locale, queryClient } }) => {
    const { messages } = await queryClient.query({
      ...intlQueryOptions({ locale, namespaces: HOME_NAMESPACES }),
      staleTime: "static",
    });
    const t = createTranslator({
      locale,
      messages: messages as Messages,
      namespace: "app.home.meta",
    });

    return { description: t("desc"), title: t("title") };
  },
  head: ({ loaderData }) =>
    pageHead({
      description: loaderData?.description,
      robots: "index, follow",
      title: loaderData?.title,
    }),
  component: HomeRoute,
});

type StepId = "admin" | "docs" | "register" | "website";

interface NextStep {
  external?: boolean;
  href: string;
  icon: LucideIcon;
  id: StepId;
}

const registerStep: NextStep = {
  href: REGISTER_HREF,
  icon: UserRoundPlus,
  id: "register",
};

const sharedSteps: NextStep[] = [
  {
    href: ADMIN_HREF,
    icon: ShieldCheck,
    id: "admin",
  },
  {
    external: true,
    href: VITNODE_DOCS_URL,
    icon: BookOpen,
    id: "docs",
  },
  {
    external: true,
    href: VITNODE_WEBSITE_URL,
    icon: Globe,
    id: "website",
  },
];

function HomeRoute() {
  return (
    <RouteMessages namespaces={HOME_NAMESPACES}>
      <HomeContent />
    </RouteMessages>
  );
}

function HomeContent() {
  const t = useTranslations("app.home");
  const { data } = useSessionQuery();
  const user = data?.user ?? null;
  const steps = user ? sharedSteps : [registerStep, ...sharedSteps];

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-14 px-4 py-16 sm:py-24">
      <section className="flex flex-col items-center gap-6 text-center">
        <LogoVitNode className="size-14" idPrefix="welcome-logo" small />

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {t("title")}
          </h1>

          <p className="text-muted-foreground mx-auto max-w-xl text-lg leading-relaxed text-pretty">
            {user ? t("desc.signed_in", { name: user.name }) : t("desc.guest")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {user ? null : (
            <Link
              className={cn(buttonVariants({ size: "lg" }), "px-5")}
              to={REGISTER_HREF}
            >
              <UserRoundPlus />
              {t("create_account")}
            </Link>
          )}

          <Link
            className={cn(
              buttonVariants({
                size: "lg",
                variant: user ? "default" : "outline",
              }),
              "px-5",
            )}
            to={ADMIN_HREF}
          >
            <ShieldCheck />
            {t("open_admin")}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {t("next_steps")}
        </h2>

        <div
          className={cn(
            "grid gap-3",
            steps.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
          )}
        >
          {steps.map(step => (
            <NextStepCard key={step.href} {...step} />
          ))}
        </div>
      </section>

      <p className="text-muted-foreground text-center text-sm text-pretty">
        {t.rich("replace_hint", {
          code: chunks => <code>{chunks}</code>,
        })}
      </p>
    </div>
  );
}

function NextStepCard({ external = false, href, icon: Icon, id }: NextStep) {
  const t = useTranslations("app.home.steps");
  const className =
    "group bg-card hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-ring/50 flex flex-col gap-3 rounded-xl border p-5 transition-colors outline-none focus-visible:ring-3";

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
          <Icon className="size-4.5" />
        </span>

        <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-medium">{t(`${id}.title`)}</span>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {t(`${id}.desc`)}
        </span>
      </div>
    </>
  );

  if (external) {
    return (
      <a
        className={className}
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return (
    <Link<RegisteredRouter, string, string> className={className} href={href}>
      {content}
    </Link>
  );
}
