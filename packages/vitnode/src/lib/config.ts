const ENVS = {
  api_url: process.env.NEXT_PUBLIC_API_URL,
  web_url: process.env.NEXT_PUBLIC_WEB_URL,
};

const urls = {
  api: new URL(ENVS.api_url ?? 'http://localhost:3000'),
  web: new URL(ENVS.web_url ?? 'http://localhost:3000'),
};

export const CONFIG = {
  node_development: process.env.NODE_ENV === 'development',
  ...urls,
};
