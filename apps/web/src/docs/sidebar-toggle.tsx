import { Button } from '@vitnode/core/components/ui/button'
import { useSidebar } from 'fumadocs-ui/components/sidebar/base'
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react'

export const DocsSidebarToggle = () => {
  const { collapsed, setCollapsed } = useSidebar()

  return (
    <Button
      aria-controls="nd-sidebar"
      aria-expanded={!collapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="text-muted-foreground hover:text-foreground aria-expanded:text-muted-foreground aria-expanded:hover:text-foreground me-2 aria-expanded:bg-transparent max-md:hidden"
      onClick={() => setCollapsed((value) => !value)}
      size="icon"
      variant="ghost"
    >
      {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
    </Button>
  )
}
