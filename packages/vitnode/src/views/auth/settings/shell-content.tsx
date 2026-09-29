import { Link, useRouter } from "@tanstack/react-router";
import { cn } from "cn";
import { ChevronLeftIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { isSettingsRootPath, SETTINGS_ROOT_HREF } from "./settings-nav";

const isFocusVisible = (element: Element | null): boolean =>
  element instanceof HTMLElement &&
  element !== document.body &&
  element.getClientRects().length > 0;

export const SettingsShellContent = ({
  children,
  footer,
  header,
  nav,
  pathname,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  nav: React.ReactNode;
  pathname: string;
}) => {
  const t = useTranslations("core.auth.settings");
  const isRoot = isSettingsRootPath(pathname);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(
    () =>
      router.subscribe("onRendered", ({ pathChanged }) => {
        if (!pathChanged || isFocusVisible(document.activeElement)) return;
        frameRef.current?.focus({ preventScroll: true });
      }),
    [router],
  );

  return (
    <div className="container mx-auto flex max-w-5xl flex-col gap-6 px-4">
      {header}

      <div
        className="flex flex-col gap-6 outline-none md:flex-row md:items-start md:gap-10"
        ref={frameRef}
        tabIndex={-1}
      >
        <aside
          className={cn(
            "md:sticky md:top-24 md:block md:w-72 md:shrink-0",
            !isRoot && "hidden",
          )}
        >
          {nav}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {isRoot ? null : (
            <Link
              className="text-primary focus-visible:ring-ring/50 -ms-2 flex h-11 w-fit items-center gap-1 rounded-md px-2 font-medium outline-none focus-visible:ring-3 md:hidden"
              to={SETTINGS_ROOT_HREF}
            >
              <ChevronLeftIcon
                aria-hidden="true"
                className="size-5 rtl:rotate-180"
              />
              {t("title")}
            </Link>
          )}
          {children}
        </div>
      </div>

      {footer}
    </div>
  );
};
