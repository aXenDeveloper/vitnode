import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";

type SidebarTogglePlacement = "sidebar" | "topbar";

const counterpartOf: Record<SidebarTogglePlacement, SidebarTogglePlacement> = {
  sidebar: "topbar",
  topbar: "sidebar",
};

// The counterpart stays `invisible` until its fade-in delay ends, and
// `focus()` on an invisible element is a no-op - retry for a few frames.
const MAX_FOCUS_FRAMES = 30;

const focusCounterpart = (placement: SidebarTogglePlacement, frame = 0) => {
  const target = document.querySelector<HTMLButtonElement>(
    `[data-admin-sidebar-toggle="${counterpartOf[placement]}"]`,
  );
  if (!target) return;

  target.focus();
  if (document.activeElement === target || frame >= MAX_FOCUS_FRAMES) return;

  requestAnimationFrame(() => {
    focusCounterpart(placement, frame + 1);
  });
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
          focusCounterpart(placement);
        });
      }}
    />
  );
};
