import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ContentPermissionsResponse } from "./permissions";

import { sessionQueryOptions } from "../auth/session-query";
import { useContentPermissions } from "./permissions";

interface Call {
  ids: number[];
  reject: () => void;
  resolve: () => void;
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** A `fetch` whose calls stay open until the test settles them. */
const deferredFetch = () => {
  const calls: Call[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const fetch = async (ids: number[]) =>
    await new Promise<ContentPermissionsResponse<number>>((resolve, reject) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls.push({
        ids,
        reject: () => {
          inFlight--;
          reject(new Error("Loading permissions failed."));
        },
        resolve: () => {
          inFlight--;
          resolve({
            items: ids.map(id => ({
              canDelete: false,
              canEdit: id % 2 === 0,
              canHide: false,
              canReport: true,
              id,
            })),
          });
        },
      });
    });

  return { calls, fetch, maxInFlight: () => maxInFlight };
};

const mount = (
  ids: number[],
  fetch: (ids: number[]) => Promise<ContentPermissionsResponse<number>>,
) => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(sessionQueryOptions().queryKey, { user: null });

  return renderHook(
    () => useContentPermissions({ fetch, ids, queryKey: ["posts"] }),
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
};

describe("useContentPermissions", () => {
  it("asks for every id once, 50 per call and 3 calls at a time", async () => {
    const ids = range(1, 230);
    const { calls, fetch, maxInFlight } = deferredFetch();
    const { result } = mount(ids, fetch);

    await waitFor(() => {
      expect(calls).toHaveLength(3);
    });
    expect(result.current.isPending).toBe(true);
    expect(result.current.of(2)).toStrictEqual({
      canDelete: false,
      canEdit: false,
      canHide: false,
      canReport: false,
    });

    for (let settled = 0; settled < 5; settled++) {
      await waitFor(() => {
        expect(calls.length).toBeGreaterThan(settled);
      });
      act(() => {
        calls[settled].resolve();
      });
    }

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(calls).toHaveLength(5);
    expect(maxInFlight()).toBe(3);
    expect(Math.max(...calls.map(call => call.ids.length))).toBe(50);
    expect(
      calls.flatMap(call => call.ids).toSorted((a, b) => a - b),
    ).toStrictEqual(ids);
    expect(result.current.isError).toBe(false);
    expect([2, 3, 228, 229].map(id => result.current.of(id))).toStrictEqual([
      { canDelete: false, canEdit: true, canHide: false, canReport: true },
      { canDelete: false, canEdit: false, canHide: false, canReport: true },
      { canDelete: false, canEdit: true, canHide: false, canReport: true },
      { canDelete: false, canEdit: false, canHide: false, canReport: true },
    ]);
  });

  it("reads a failed batch as all false and keeps the others", async () => {
    const { calls, fetch } = deferredFetch();
    const { result } = mount(range(1, 120), fetch);

    await waitFor(() => {
      expect(calls).toHaveLength(3);
    });
    act(() => {
      calls[0].resolve();
      calls[1].reject();
      calls[2].resolve();
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.isError).toBe(true);
    const [failed] = calls[1].ids;
    const [answered] = calls[2].ids.filter(id => id % 2 === 0);
    expect(result.current.of(failed)).toStrictEqual({
      canDelete: false,
      canEdit: false,
      canHide: false,
      canReport: false,
    });
    expect(result.current.of(answered)).toStrictEqual({
      canDelete: false,
      canEdit: true,
      canHide: false,
      canReport: true,
    });
  });
});
