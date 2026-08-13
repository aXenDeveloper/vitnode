import { cn } from "@/lib/utils";

export const UserFormat = ({
  user,
  format,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  format?: boolean;
  // Only what is rendered. Asking for an id, a handle and a role id it never
  // reads would make a caller that has a name and a colour - a revision's
  // author, a log line - invent three values to satisfy the type.
  user: {
    name: string;
    role: {
      color: null | string;
    };
  };
}) => {
  return (
    <span
      className={cn("font-medium", className)}
      style={{
        ...(format && user.role.color ? { color: user.role.color } : {}),
        ...style,
      }}
      {...props}
    >
      {user.name}
    </span>
  );
};
