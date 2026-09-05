import type { Plugin } from "vite";

import { loadEnv } from "vite";

const CLIENT_ENV_KEYS = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WEB_URL"] as const;

export interface VitNodeEnvOptions {
  clientEnv?: readonly string[];
}

export const vitNodeEnv = ({
  clientEnv = [],
}: VitNodeEnvOptions = {}): Plugin => {
  // De-duplicated, so an app that names one of the package's own keys gets one
  // `define` entry rather than a silently repeated one.
  const keys = [...new Set([...CLIENT_ENV_KEYS, ...clientEnv])];

  return {
    config: (userConfig, { mode }) => {
      // Empty prefix: the whole `.env`, not just the public keys. This is the
      // server's copy, and a mounted VitNode API needs the database and Redis
      // URLs from it.
      const env = loadEnv(mode, userConfig.root ?? process.cwd(), "");

      // `??=`, so a real environment variable - Docker, Vercel, CI - always wins
      // over a `.env` file left in the working directory.
      for (const [key, value] of Object.entries(env)) {
        process.env[key] ??= value;
      }

      return {
        environments: {
          client: {
            define: Object.fromEntries(
              keys.map(key => [
                `process.env.${key}`,
                // `undefined` when unset rather than nothing at all: the read
                // has to be replaced either way, or it throws in the browser
                // instead of falling through to the default `CONFIG` already has
                // for it.
                process.env[key] === undefined
                  ? "undefined"
                  : JSON.stringify(process.env[key]),
              ]),
            ),
          },
        },
      };
    },
    name: "vitnode:env",
  };
};
