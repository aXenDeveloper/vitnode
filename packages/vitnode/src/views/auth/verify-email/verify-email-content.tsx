import { Card } from "@/components/ui/card";

export const VerifyEmailContent = ({
  children,
}: {
  children: React.ReactNode;
}) => (
  <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 md:min-h-[calc(100vh-4rem)]">
    <Card>{children}</Card>
  </div>
);
