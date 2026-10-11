import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

type SidebarTogglePlacement = "sidebar" | "topbar";

const counterpartOf: Record<SidebarTogglePlacement, SidebarTogglePlacement> = {
  sidebar: "topbar",
  topbar: "sidebar",
};

export const AdminSidebarToggle = ({
  placement,
}: {
  placement: SidebarTogglePlacement;
}) => {
  const { isMobile } = useSidebar();

  return (
    <SidebarTrigger
      data-admin-sidebar-toggle={placement}
      onClick={event => {
        if (isMobile || event.currentTarget !== document.activeElement) return;

        requestAnimationFrame(() => {
          document
            .querySelector<HTMLButtonElement>(
              `[data-admin-sidebar-toggle="${counterpartOf[placement]}"]`,
            )
            ?.focus();
        });
      }}
    />
  );
};
