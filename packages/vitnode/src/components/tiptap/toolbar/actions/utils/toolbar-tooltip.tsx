import { TooltipGroupTrigger } from "@/components/ui/tooltip";

export const ToolbarTooltip = ({
  children,
  text,
}: {
  children: React.ReactElement;
  text: React.ReactNode;
}) => <TooltipGroupTrigger content={text} render={children} />;
