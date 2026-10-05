import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const EditSheetContent = ({
  children,
  description,
  title,
}: {
  children: React.ReactNode;
  description: React.ReactNode;
  title: React.ReactNode;
}) => (
  <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
    <SheetHeader className="border-b">
      <SheetTitle className="flex items-center gap-2">{title}</SheetTitle>
      <SheetDescription className="text-pretty">{description}</SheetDescription>
    </SheetHeader>
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
      {children}
    </div>
  </SheetContent>
);
