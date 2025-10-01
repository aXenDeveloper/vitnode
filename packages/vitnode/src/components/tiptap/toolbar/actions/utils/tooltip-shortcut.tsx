import { CtrlOrCommandCharacter } from "@/lib/ctrl-or-command-character";

export const TooltipShortcut = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <span className="ml-2 text-xs tracking-widest">
      <CtrlOrCommandCharacter />
      {children}
    </span>
  );
};
