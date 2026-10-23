import { cn } from "cn";
import { ViewTransition } from "react";

export const AuthStep = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <ViewTransition
    default="none"
    enter="vitnode-auth-step-in"
    exit="vitnode-auth-step-out"
  >
    <div className={cn("flex flex-col gap-6", className)}>{children}</div>
  </ViewTransition>
);
