import { Route } from './route';
import { Test } from './test';

type FetcherParams<
  T extends { plugin: string; routes: Route },
  R extends T['routes'][number],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
> = R extends any
  ? Pick<R['route'], 'method' | 'path'> & { plugin: T['plugin'] }
  : never;

function fetcher<T extends { plugin: string; routes: Route }>(
  params: FetcherParams<T, T['routes'][number]>,
) {
  const { path, method, plugin } = params;
}

export const testFetcher = () => {
  fetcher<Test>({ path: '/test34', method: 'get', plugin: 'test_plugin' });
  fetcher<Test>({ path: '/test2', method: 'post', plugin: 'test_plugin' });
};
