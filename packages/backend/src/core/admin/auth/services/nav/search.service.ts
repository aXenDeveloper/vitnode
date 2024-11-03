import { Injectable } from '@nestjs/common';
import {
  NavSearchNavAuthAdmin,
  SearchNavAuthAdminObj,
  SearchNavAuthAdminQuery,
} from 'vitnode-shared/admin/auth.dto';
import { User } from 'vitnode-shared/user.dto';

import { NavAuthAdminService } from './nav.service';

@Injectable()
export class SearchAuthAdminService {
  constructor(private readonly navAdminService: NavAuthAdminService) {}

  async search({
    user,
    query,
  }: {
    query: SearchNavAuthAdminQuery;
    user: User;
  }): Promise<SearchNavAuthAdminObj> {
    const search = query.search
      ? query.search.trim().toLowerCase().split(' ')
      : [];

    // Flat map to remove children
    const nav: NavSearchNavAuthAdmin[] = (
      await this.navAdminService.nav({ user })
    )
      .flatMap(item => {
        const nav = item.nav.flatMap(nav => ({
          code_plugin: item.code,
          ...nav,
        }));

        return nav.flatMap(nav => {
          const mappedChildren = (nav.children ?? []).map(child => ({
            code_plugin: nav.code_plugin,
            parent_nav_code: nav.children ? nav.code : undefined,
            ...child,
          }));

          return [nav, ...mappedChildren];
        });
      })
      .filter(nav => nav.keywords.length);

    if (search.length === 0) {
      return {
        nav: nav.splice(0, 10),
      };
    }

    return {
      nav: nav.filter(
        nav =>
          nav.keywords.some(item =>
            search.some(search => item.toLowerCase().includes(search)),
          ) || search.some(search => nav.code.toLowerCase().includes(search)),
      ),
    };
  }
}
