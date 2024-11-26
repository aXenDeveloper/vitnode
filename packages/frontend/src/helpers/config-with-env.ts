const ENVS = {
  backend_url: process.env.NEXT_PUBLIC_BACKEND_URL,
  backend_client_url: process.env.NEXT_PUBLIC_BACKEND_CLIENT_URL,
  frontend_url: process.env.NEXT_PUBLIC_FRONTEND_URL,
};

const urls = {
  backend: new URL(ENVS.backend_url ?? 'http://localhost:8080'),
  backend_client: new URL(
    ENVS.backend_client_url ?? ENVS.backend_url ?? 'http://localhost:8080',
  ),
  frontend: new URL(ENVS.frontend_url ?? 'http://localhost:3000'),
};

export const CONFIG = {
  backend_url: urls.backend.origin,
  backend_client_url: urls.backend_client.origin,
  frontend_url: urls.frontend.origin,
  backend_public_url: `${urls.backend.origin}/public`,
  backend_client_public_url: `${urls.backend_client.origin}/public`,
  local_storage: {
    editor_skin_tone: 'emoji:skin-tone',
  },
  node_development: process.env.NODE_ENV === 'development',
  backend: urls.backend,
  frontend: urls.frontend,
};
