export interface AuthLinkProps extends Omit<React.ComponentProps<"a">, "href"> {
  href: string;
}

export type AuthLinkComponent = (props: AuthLinkProps) => React.ReactNode;

export const AUTH_HREF = {
  resetPassword: "/login/reset-password",
  signIn: "/login",
  signUp: "/register",
} as const;
