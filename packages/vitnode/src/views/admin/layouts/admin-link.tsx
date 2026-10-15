import { HrefLink, type HrefLinkProps } from "@/tanstack/link";

export type AdminLinkProps = Omit<HrefLinkProps, "activeOptions">;

/** The router's prefix match, as the AdminCP navigation has always had it. */
const PREFIX_MATCH = { exact: false };

export const AdminLink = (props: AdminLinkProps) => (
  <HrefLink {...props} activeOptions={PREFIX_MATCH} />
);
