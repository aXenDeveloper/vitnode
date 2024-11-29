import { Button } from '@/components/ui/button';
import { DrawerClose } from '@/components/ui/drawer';
import { Link } from '@/navigation';

interface Props
  extends React.HTMLAttributes<HTMLAnchorElement | HTMLButtonElement> {
  href?: string;
  icon: React.ReactNode;
  name: string;
  target?: string;
}

export const ItemUserNavBarMobile = ({
  name,
  icon,
  href,
  target,
  ...props
}: Props) => {
  const content = (
    <>
      {icon} <span className="truncate">{name}</span>
    </>
  );

  return (
    <DrawerClose asChild>
      <Button
        asChild={!!href}
        className="[&_svg]:text-muted-foreground max-w-full justify-start [&_svg]:flex-shrink-0"
        variant="ghost"
        {...props}
      >
        {href ? (
          <Link href={href} target={target}>
            {content}
          </Link>
        ) : (
          content
        )}
      </Button>
    </DrawerClose>
  );
};
