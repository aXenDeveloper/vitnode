"use client";

import type { ButtonProps } from "@/components/ui/button";

import { Button } from "@/components/ui/button";

import type { ContentFormLinkComponent } from "../form/context";

/**
 * `Omit` over a union, member by member.
 *
 * `ButtonProps` is a union - an icon-sized button *requires* an `aria-label` and
 * a text one does not - and a plain `Omit` collapses it into one member, which
 * loses `size: "icon"` entirely. Distributing keeps both arms, so the row's edit
 * control can be an icon button and the heading's create control cannot forget
 * its label.
 */
type WithoutLinkProps<T> = T extends unknown
  ? Omit<T, "nativeButton" | "render">
  : never;

/**
 * A button that is really a link, wearing the host's link component.
 *
 * Its own module-scope component so the injected one arrives as a **prop**: a
 * component read out of a hook and rendered in the same pass is a component
 * created during render, which React is entitled to remount and which
 * `@eslint-react/static-components` refuses outright. `HeaderContent` takes its
 * `BackLink` the same way, `ContentFormCancel` in `form/primitives.tsx` does the
 * same for the cancel button, and this is the third and last of them - the
 * create and edit controls a page-mode content type renders instead of a dialog
 * trigger.
 *
 * Every other prop passes straight through to `Button`, which is what lets the
 * row's edit control stay an icon button inside a tooltip trigger while the
 * heading's create control stays a full-width primary button.
 */
export const ContentLinkButton = ({
  children,
  href,
  LinkComponent,
  ...props
}: WithoutLinkProps<ButtonProps> & {
  href: string;
  LinkComponent: ContentFormLinkComponent;
}) => (
  <Button
    {...props}
    nativeButton={false}
    render={<LinkComponent href={href} />}
  >
    {children}
  </Button>
);
