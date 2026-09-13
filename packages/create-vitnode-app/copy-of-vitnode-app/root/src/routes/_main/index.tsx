import type { LucideIcon } from "lucide-react";

import type { RegisteredRouter } from "@tanstack/react-router";

import { createFileRoute, Link } from "@tanstack/react-router";
import { LogoVitNode } from "@vitnode/core/components/logo-vitnode";
import { buttonVariants } from "@vitnode/core/components/ui/button";
import {
  VITNODE_DOCS_URL,
  VITNODE_WEBSITE_URL,
} from "@vitnode/core/lib/docs-links";
import { useSessionQuery } from "@vitnode/core/tanstack/auth";
import { pageHead } from "@vitnode/core/tanstack/metadata";
import { cn } from "cn";
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  ShieldCheck,
  UserRoundPlus,
} from "lucide-react";

const REGISTER_HREF = "/register";
const ADMIN_HREF = "/admin";

export const Route = createFileRoute("/_main/")({
  head: () =>
    pageHead({
      description: "Your VitNode app is up and running.",
      robots: "index, follow",
      title: "Welcome",
    }),
  component: HomeRoute,
});

interface NextStep {
  description: string;
  external?: boolean;
  href: string;
  icon: LucideIcon;
  title: string;
}

const registerStep: NextStep = {
  description:
    "Create a member account. On a fresh install the first one becomes the administrator.",
  href: REGISTER_HREF,
  icon: UserRoundPlus,
  title: "Register",
};

const sharedSteps: NextStep[] = [
  {
    description: "Settings, members, roles, plugins and content live here.",
    href: ADMIN_HREF,
    icon: ShieldCheck,
    title: "AdminCP",
  },
  {
    description: "Configuration, routing, plugins and deployment guides.",
    external: true,
    href: VITNODE_DOCS_URL,
    icon: BookOpen,
    title: "Documentation",
  },
  {
    description: "Project website, release notes and community links.",
    external: true,
    href: VITNODE_WEBSITE_URL,
    icon: Globe,
    title: "vitnode.com",
  },
];

function HomeRoute() {
  const { data } = useSessionQuery();
  const user = data?.user ?? null;
  const steps = user ? sharedSteps : [registerStep, ...sharedSteps];

  return (
    <div className="container mx-auto flex max-w-3xl flex-col gap-14 px-4 py-16 sm:py-24">
      <section className="flex flex-col items-center gap-6 text-center">
        <LogoVitNode className="size-14" idPrefix="welcome-logo" small />

        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Your VitNode app is running
          </h1>

          <p className="text-muted-foreground mx-auto max-w-xl text-lg leading-relaxed text-pretty">
            {user
              ? `You are signed in as ${user.name}. Open the AdminCP to configure the site.`
              : "Create an account or sign in, then open the AdminCP to configure the site. On a fresh install the first registered member becomes the administrator."}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {user ? null : (
            <Link
              className={cn(buttonVariants({ size: "lg" }), "px-5")}
              to={REGISTER_HREF}
            >
              <UserRoundPlus />
              Create an account
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
            Open AdminCP
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          Next steps
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
        This page lives in <code>src/routes/_main/index.tsx</code>. Replace it
        whenever you are ready.
      </p>
    </div>
  );
}

function NextStepCard({
  description,
  external = false,
  href,
  icon: Icon,
  title,
}: NextStep) {
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
        <span className="font-medium">{title}</span>
        <span className="text-muted-foreground text-sm leading-relaxed text-pretty">
          {description}
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
