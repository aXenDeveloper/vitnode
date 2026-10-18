/**
 * The public site's page frame: `listeners`, then `header`, then `breadcrumb`,
 * then the page inside `<main>`. Each slot is optional and renders nothing
 * when unset. Universal.
 *
 * @example
 * ```tsx
 * import { Outlet } from "@tanstack/react-router";
 * import { MainBreadcrumb } from "@vitnode/core/tanstack/breadcrumb";
 * import { MainHeader, ThemeLayoutContent } from "@vitnode/core/tanstack/layout";
 *
 * const MainLayout = () => (
 *   <ThemeLayoutContent breadcrumb={<MainBreadcrumb />} header={<MainHeader />}>
 *     <Outlet />
 *   </ThemeLayoutContent>
 * );
 * ```
 */
export const ThemeLayoutContent = ({
  breadcrumb,
  children,
  header,
  listeners,
}: {
  /** Rendered between the header and `<main>`, or nothing. */
  breadcrumb?: React.ReactNode;
  children: React.ReactNode;
  /** The site header. A slot, because its contents are framework-bound. */
  header?: React.ReactNode;
  /** Invisible components rendered before the header, e.g. event listeners. */
  listeners?: React.ReactNode;
}) => (
  <>
    {listeners}
    {header}
    {breadcrumb}
    <main>{children}</main>
  </>
);
