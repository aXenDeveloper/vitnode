import { getRedirectUri, SSOApiPlugin } from '@/api/models/sso';
import { HTTPException } from 'hono/http-exception';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

export const DiscordSSOApiPlugin = ({
  clientId = '',
  clientSecret = '',
}: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = 'discord';
  const redirectUri = getRedirectUri(id);
  const userSchema = z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
  });
  const tokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
  });

  return {
    fetchToken: async code => {
      if (!clientId || !clientSecret) {
        throw new Error('Missing Discord client ID or secret');
      }

      const res = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!res.ok) {
        throw new HTTPException(
          +res.status.toString() as ContentfulStatusCode,
          {
            message: 'Internal error requesting token',
          },
        );
      }

      const { data, error } = tokenSchema.safeParse(await res.json());
      if (error || !data) {
        throw new HTTPException(400, {
          message: 'Invalid token response',
        });
      }

      return data;
    },
    fetchUser: async ({ token_type, access_token }) => {
      const res = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      });
      const { data, error } = userSchema.safeParse(await res.json());
      if (error || !data) {
        throw new HTTPException(400, {
          message: 'Invalid user response',
        });
      }

      return data;
    },
    getUrl: ({ state }) => {
      if (!clientId) {
        throw new Error('Missing Discord client ID');
      }

      const url = new URL('https://discord.com/oauth2/authorize');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'identify email');
      url.searchParams.set('state', state);

      return url.toString();
    },
    id,
    name: 'Discord',
  };
};
