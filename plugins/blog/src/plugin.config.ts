import { buildPluginConfig } from 'vitnode/plugin.config';

export const blogPlugin = () => {
  return buildPluginConfig({
    id: 'blog',
    routes: [],
  });
};
