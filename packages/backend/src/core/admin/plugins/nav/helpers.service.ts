import { Injectable } from '@nestjs/common';
import { ItemNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';
import { ConfigPlugin } from 'vitnode-shared/admin/plugin.dto';

@Injectable()
export class HelpersAdminNavPluginsService {
  protected findItemByCode({
    items,
    code,
  }: {
    code: string;
    items: ConfigPlugin['nav'];
  }):
    | (ItemNavAuthAdminObj & {
        children?: ItemNavAuthAdminObj[];
        parent_code?: string;
      })
    | null {
    for (const item of items ?? []) {
      if (item.code === code) {
        return {
          ...item,
          keywords: item.keywords ?? [],
          children: (item.children ?? []).map(child => ({
            ...child,
            keywords: child.keywords ?? [],
          })),
        };
      }

      if (item.children) {
        const found = this.findItemByCode({ items: item.children, code });
        if (found) {
          return {
            ...found,
            parent_code: item.code,
          };
        }
      }
    }

    return null;
  }
}
