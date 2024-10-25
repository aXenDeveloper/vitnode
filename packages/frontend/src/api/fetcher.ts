import { CONFIG } from '@/helpers/config-with-env';

export async function fetcher<
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
  TData extends Record<string, any>,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters, @typescript-eslint/no-explicit-any
  TVariable extends Record<string, any> = Record<string, any>,
>({
  url,
  body,
  ...options
}: {
  body?: TVariable;
  url: string;
} & Omit<RequestInit, 'body'>): Promise<{
  data: TData;
  res: Response;
}> {
  const res = await fetch(`${CONFIG.backend_url}${url}`, {
    ...options,
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();

  if (!res.ok) {
    const error: { message: string; statusCode: number } = data;
    throw new Error(`${error.statusCode} - ${error.message}`);
  }

  return { res, data };
}
