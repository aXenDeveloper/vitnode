import { z } from "zod";

import type { PublicNavigationMenus } from "@/api/modules/admin/navigation/lib/cache";

import { loadLucideIcon } from "@/components/ui/icon-registry";
import { parseEmojiIcon } from "@/lib/emoji-icon";

export const zodLucideIconSchema = z.object({
  aliases: z.array(z.string()).optional(),
  name: z.string().optional(),
  node: z.array(z.tuple([z.string(), z.record(z.string(), z.string())])),
  size: z.number().optional(),
});

const lucideIconNamesOf = ({
  bottomBar,
  navigation,
}: PublicNavigationMenus): string[] => {
  const names = new Set<string>();
  const items = [
    ...bottomBar,
    ...navigation,
    ...navigation.flatMap(node => node.items),
  ];

  for (const item of items) {
    const parsed = parseEmojiIcon(item.icon);

    if (parsed?.type === "icon") names.add(parsed.value);
  }

  return [...names];
};

export const loadNavigationIcons = async (
  menus: PublicNavigationMenus,
): Promise<Record<string, z.infer<typeof zodLucideIconSchema>>> => {
  const loaded = await Promise.all(
    lucideIconNamesOf(menus).map(
      async name =>
        [
          name,
          zodLucideIconSchema.safeParse(await loadLucideIcon(name)),
        ] as const,
    ),
  );

  return Object.fromEntries(
    loaded.flatMap(([name, icon]) => (icon.success ? [[name, icon.data]] : [])),
  );
};
