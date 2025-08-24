export interface EnvironmentConfig {
  WORKSPACE: string;
  EVENT_PATH: string;
  VERSION_TYPE: string;
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
  RELEASE_TYPE?: string;
  GITHUB_HEAD_REF?: string;
  GITHUB_REF?: string;
  GITHUB_ACTOR?: string;
  GITHUB_OPTION_MODE?: string;
  GIT_USER: {
    NAME: string;
    EMAIL: string;
  };
}

export function validateEnvironment(): EnvironmentConfig {
  const required = {
    WORKSPACE: process.env.GITHUB_WORKSPACE || process.cwd(),
    EVENT_PATH: process.env.GITHUB_EVENT_PATH,
    VERSION_TYPE: process.env.VERSION_TYPE,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
  };

  Object.entries(required).forEach(([key, value]) => {
    if (!value)
      throw new Error(`Missing required environment variable: ${key}`);
  });

  return {
    ...required,
    RELEASE_TYPE: process.env.RELEASE_TYPE,
    GITHUB_HEAD_REF: process.env.GITHUB_HEAD_REF,
    GITHUB_REF: process.env.GITHUB_REF,
    GITHUB_ACTOR: process.env.GITHUB_ACTOR,
    GITHUB_OPTION_MODE: process.env.GITHUB_OPTION_MODE,
    GIT_USER: {
      NAME: process.env.GITHUB_USER ?? 'Automated Version Bump',
      EMAIL:
        process.env.GITHUB_EMAIL ??
        'gh-action-bump-version@users.noreply.github.com',
    },
  } as EnvironmentConfig;
}
