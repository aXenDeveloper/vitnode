import { HrefLink, type HrefLinkProps } from "@/tanstack/link";

export type AdminLinkProps = Omit<HrefLinkProps, "activeOptions">;

const PREFIX_MATCH = { exact: false };

export const AdminLink = (props: AdminLinkProps) => (
  <HrefLink {...props} activeOptions={PREFIX_MATCH} />
);
