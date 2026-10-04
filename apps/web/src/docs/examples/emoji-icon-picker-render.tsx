import { EmojiIcon } from '@vitnode/core/components/ui/emoji-icon'
import { parseEmojiIcon } from '@vitnode/core/lib/emoji-icon'

const ROLES = [
  { name: 'Administrator', prefix: 'icon:shield-check' },
  { name: 'Moderator', prefix: 'icon:gavel' },
  { name: 'Early supporter', prefix: 'emoji:🚀' },
  { name: 'Translator', prefix: 'emoji:🌍' },
  { name: 'Member', prefix: 'icon:../../etc/passwd' },
]

export default function EmojiIconPickerRenderExample() {
  return (
    <ul className="not-prose bg-card text-card-foreground flex w-full flex-col divide-y rounded-xl border">
      {ROLES.map((role) => (
        <li
          className="flex items-center justify-between gap-4 px-4 py-3"
          key={role.name}
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <EmojiIcon
              className="text-muted-foreground"
              value={parseEmojiIcon(role.prefix)}
            />
            {role.name}
          </span>
          <code className="text-muted-foreground truncate text-xs">
            {role.prefix}
          </code>
        </li>
      ))}
    </ul>
  )
}
