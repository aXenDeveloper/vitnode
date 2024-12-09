import { CONFIG } from '@/helpers/config-with-env';

import { buildFilteredQuery } from './helpers';

export async function fetcherClient<
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
  TData extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TVariable extends Record<string, any> = Record<string, any>,
>({
  url,
  body,
  query: queryFromArgs,
  ...options
}: Omit<RequestInit, 'body'> & {
  body?: FormData | TVariable;
  query?: TVariable;
  url: string;
}): Promise<{
  data: TData;
  res: Response;
}> {
  const query = queryFromArgs ? buildFilteredQuery(queryFromArgs) : '';
  const href = `${CONFIG.backend_client_url}${url}${query ? `?${query}` : ''}`;
  const method = options?.method ?? 'GET';
  const res = await fetch(href, {
    ...options,
    method,
    headers: {
      ...(body &&
        !(body instanceof FormData) && { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
    credentials: 'include',
    mode: 'cors',
    body: body
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : null,
  });

  if (res.headers.get('Content-Disposition')) {
    return { res, data: {} as TData };
  }

  let data = {} as TData;
  try {
    data = await res.json();
  } catch (_) {
    /* empty */
  }

  if (!res.ok) {
    const error = data as unknown as { message: string; statusCode: number };
    throw new Error(`${error.statusCode} - ${error.message}`);
  }

  return { res, data };
}
