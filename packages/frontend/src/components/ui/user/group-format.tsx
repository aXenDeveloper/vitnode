import { cn } from '@/helpers/classnames';
import { useTextLang } from '@/hooks/use-text-lang';
import { GroupUser } from 'vitnode-shared/user.dto';

export const GroupFormat = ({
  className,
  group: { name, color },
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  group: GroupUser;
}) => {
  const { convertText } = useTextLang();

  return (
    <span
      className={cn('text-[--group-color]', className)}
      style={{ '--group-color': color } as React.CSSProperties}
      {...props}
    >
      {convertText(name)}
    </span>
  );
};
