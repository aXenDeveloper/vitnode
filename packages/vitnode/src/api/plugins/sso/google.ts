import { getRedirectUri, SSOApiPlugin } from '@/api/models/sso';
import { HTTPException } from 'hono/http-exception';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

export const GoogleSSOApiPlugin = ({
  clientId,
  clientSecret,
}: {
  clientId: string | undefined;
  clientSecret: string | undefined;
}): SSOApiPlugin => {
  const id = 'google';
  const redirectUri = getRedirectUri(id);
  const tokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
  });
  const userSchema = z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    verified_email: z.boolean(),
  });

  return {
    id,
    name: 'Google',
    fetchToken: async code => {
      if (!clientId || !clientSecret) {
        throw new Error('Missing Google client ID or secret');
      }

      const res = await fetch('https://oauth2.googleapis.com/token', {
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
      const res = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: {
          Authorization: `${token_type} ${access_token}`,
        },
      });
      const dataFromRes = await res.json();
      const { data, error } = userSchema.safeParse(dataFromRes);
      if (error || !data) {
        throw new HTTPException(400, {
          message: 'Invalid user response',
        });
      }

      if (!data.verified_email) {
        throw new HTTPException(400, {
          message: 'Email not verified',
        });
      }

      return {
        ...data,
        username: data.name,
      };
    },
    getUrl: ({ state }) => {
      if (!clientId) {
        throw new Error('Missing Google client ID');
      }

      const url = new URL('https://accounts.google.com/o/oauth2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid profile email');
      url.searchParams.set('state', state);

      return url.toString();
    },
  };
};
