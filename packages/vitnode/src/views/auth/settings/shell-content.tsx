import { useRouter } from "@tanstack/react-router";
import React from "react";

const isFocusVisible = (element: Element | null): boolean =>
  element instanceof HTMLElement &&
  element !== document.body &&
  element.getClientRects().length > 0;

export const SettingsShellContent = ({
  children,
  footer,
  header,
  nav,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  nav: React.ReactNode;
}) => {
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
    <div className="container mx-auto flex flex-col gap-6 px-4">
      {header}

      <div
        className="flex flex-col gap-6 outline-none md:flex-row md:items-start md:gap-10"
        ref={frameRef}
        tabIndex={-1}
      >
        <aside className="md:sticky md:top-24 md:w-64 md:shrink-0">{nav}</aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>

      {footer}
    </div>
  );
};
