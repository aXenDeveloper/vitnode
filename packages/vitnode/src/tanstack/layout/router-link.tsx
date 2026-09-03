"use client";

import { Link } from "@tanstack/react-router";

import type { AuthLinkProps } from "@/views/auth/auth-link";

export const RouterLink = ({ children, href, ...props }: AuthLinkProps) => (
  <Link {...props} to={href}>
    {children}
  </Link>
);
