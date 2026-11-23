import {
  AtSignIcon,
  BanIcon,
  BellIcon,
  ClipboardCheckIcon,
  ClockIcon,
  FileTextIcon,
  type LucideIcon,
  MegaphoneIcon,
  ReplyIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SmilePlusIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

const TYPE_ICONS: Record<string, LucideIcon> = {
  "core.account_suspended": BanIcon,
  "core.admin_message": MegaphoneIcon,
  "core.mention": AtSignIcon,
  "core.reaction_received": SmilePlusIcon,
  "core.suspension_revoked": ShieldCheckIcon,
  "core.warning_issued": ShieldAlertIcon,
  "core.warning_revoked": ShieldCheckIcon,
};

const SUFFIX_ICONS: [suffix: string, icon: LucideIcon][] = [
  ["_reply", ReplyIcon],
  ["_pending", ClockIcon],
  ["_decision", ClipboardCheckIcon],
];

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  account: UserRoundIcon,
  content: FileTextIcon,
  moderation: ShieldIcon,
  social: UsersIcon,
  system: BellIcon,
};

export const notificationTypeIcon = ({
  category,
  type,
}: {
  category: string;
  type: string;
}): LucideIcon =>
  TYPE_ICONS[type] ??
  SUFFIX_ICONS.find(([suffix]) => type.endsWith(suffix))?.[1] ??
  CATEGORY_ICONS[category] ??
  BellIcon;
