import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Where a staff form hands a finished entry.
 *
 * Router-global rather than route-bound: a create form navigates *away* from the
 * route that rendered it, to the record it just made.
 */
export const useStaffFormNavigate = (): ((href: string) => Promise<void>) => {
  const router = useRouter();

  return useCallback(
    async (href: string) => {
      await router.navigate({ to: href });
    },
    [router],
  );
};
