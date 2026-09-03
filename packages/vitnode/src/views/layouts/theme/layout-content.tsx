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

  listeners?: React.ReactNode;
}) => (
  <>
    {listeners}
    {header}
    {breadcrumb}
    <main>{children}</main>
  </>
);
