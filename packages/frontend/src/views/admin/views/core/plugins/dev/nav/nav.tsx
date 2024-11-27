import { fetcher } from '@/api/fetcher';
import { DynamicIcon } from '@/components/icon/dynamic-icon';
import { HeaderContent } from '@/components/ui/header-content';
import { TextAndIconsAsideAdmin } from '@/views/admin/layout/sidebar/sidebar';
import { getTranslations } from 'next-intl/server';
import { ParentNavAuthAdminObj } from 'vitnode-shared/admin/auth.dto';

import { CreateNavDevPluginAdmin } from './actions/create';
import { ContentNavDevPluginAdmin } from './content';

const getData = async (code: string) => {
  const { data } = await fetcher<ParentNavAuthAdminObj[]>({
    url: `/admin/plugins/nav/${code}`,
  });

  return data;
};

export const NavDevPluginAdminView = async ({
  pluginCode,
}: {
  pluginCode: string;
}) => {
  const [data, t, tGlobal] = await Promise.all([
    getData(pluginCode),
    getTranslations('admin.core.plugins.dev.nav'),
    getTranslations(),
  ]);

  // Flat map to remove children
  const nav: {
    code: string;
    icon?: string;
    parent_icon?: string;
    parent_nav_code?: string;
    plugin: string;
  }[] = data.flatMap(nav => {
    const children = nav.children ?? [];
    const mappedChildren = children.map(child => ({
      parent_nav_code: nav.children ? nav.code : undefined,
      ...child,
      parent_icon: nav.icon,
      plugin: pluginCode,
    }));

    return [{ ...nav, plugin: pluginCode }, ...mappedChildren];
  });

  const textsAndIcons: TextAndIconsAsideAdmin[] = nav.map(item => {
    const id = item.parent_nav_code
      ? `${item.parent_nav_code}_${item.code}`
      : item.code;

    return {
      id,
      parent_text: item.parent_nav_code
        ? // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          tGlobal(`admin_${item.plugin}.nav.${item.parent_nav_code}`)
        : undefined,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      text: tGlobal(`admin_${item.plugin}.nav.${id}`),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      plugin: tGlobal(`admin_${item.plugin}.nav.title`),
      icon: item.icon ? <DynamicIcon name={item.icon} /> : null,
      plugin_code: item.plugin,
    };
  });

  return (
    <>
      <HeaderContent h1={t('title')}>
        <CreateNavDevPluginAdmin
          dataFromSSR={data}
          textsAndIcons={textsAndIcons}
        />
      </HeaderContent>

      <ContentNavDevPluginAdmin data={data} textsAndIcons={textsAndIcons} />
    </>
  );
};
