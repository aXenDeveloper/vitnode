import { CommandItem, CommandShortcut } from '@/components/ui/command';
import { useRouter } from '@/navigation';
import { NavSearchNavAuthAdmin } from 'vitnode-shared/admin/auth.dto';

import { TextAndIconsAsideAdmin } from '../../sidebar';

export const PageItemContentSearchAsideAuthAdmin = ({
  code,
  code_plugin,
  parent_nav_code,
  setOpen,
  textAndIcon,
}: {
  setOpen: (open: boolean) => void;
  textAndIcon: TextAndIconsAsideAdmin;
} & Pick<
  NavSearchNavAuthAdmin,
  'code' | 'code_plugin' | 'parent_nav_code'
>) => {
  const { push } = useRouter();
  const href = parent_nav_code
    ? `/admin/${code_plugin}/${parent_nav_code}/${code}`
    : `/admin/${code_plugin}/${code}`;

  return (
    <CommandItem
      onSelect={() => {
        push(href);
        setOpen(false);
      }}
    >
      <div>
        <span className="[&>svg]:text-muted-foreground flex flex-wrap items-center gap-1 [&>svg]:flex-shrink-0">
          {textAndIcon.icon} <span>{textAndIcon.text}</span>
        </span>
        {parent_nav_code && (
          <p className="text-muted-foreground">{textAndIcon.parent_text}</p>
        )}
      </div>
      <CommandShortcut>{textAndIcon.plugin}</CommandShortcut>
    </CommandItem>
  );
};
