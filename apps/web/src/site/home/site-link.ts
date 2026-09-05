export type SiteLinkComponent = React.ComponentType<
  Omit<React.ComponentProps<'a'>, 'href'> & { href: string }
>
