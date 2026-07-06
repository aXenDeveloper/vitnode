import { cn } from "@/lib/utils";

export const UserFormat = ({
  user,
  format,
  className,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  format?: boolean;
  user: {
    id: number;
    name: string;
    nameCode: string;
    role: {
      color: null | string;
      id: number;
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
