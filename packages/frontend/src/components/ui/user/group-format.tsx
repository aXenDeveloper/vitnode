import { cn } from '@/helpers/classnames';
import { useTextLang } from '@/hooks/use-text-lang';
import { GroupUser } from 'vitnode-shared/user.dto';

export const GroupFormat = ({
  className,
  group: { name, color },
}: {
  className?: string;
  group: GroupUser;
}) => {
  const { convertText } = useTextLang();

  return (
    <span
      className={cn('text-[--group-color]', className)}
      style={{ '--group-color': color } as React.CSSProperties}
    >
      {convertText(name)}
    </span>
  );
};
