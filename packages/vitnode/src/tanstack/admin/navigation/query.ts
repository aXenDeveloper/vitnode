import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { AdminNavigationFormProps } from "@/views/admin/views/core/navigation/navigation-form-content";
import type { NavigationAdminListProps } from "@/views/admin/views/core/navigation/navigation-list-content";
import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";
import type { AdminIdentity } from "@/views/admin/views/core/shared/admin-scope";

import { parseNavigationPresetKey } from "@/lib/navigation";
import {
  createAdminNavigation,
  deleteAdminNavigation,
  reorderAdminNavigation,
  updateAdminNavigation,
} from "@/views/admin/views/core/navigation/navigation-mutations";
import {
  adminNavigationPresetsQueryOptions,
  adminNavigationQueryOptions,
  adminNavigationQueryRoot,
} from "@/views/admin/views/core/navigation/navigation-query";

import { invalidateMiddlewareConfig } from "../../auth/middleware-config";
import { useAdminIdentity } from "../identity";

export const adminNavigationQuery = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) => adminNavigationQueryOptions({ adminUserId });

export const adminNavigationPresetsQuery = ({
  adminUserId,
}: {
  adminUserId: AdminIdentity;
}) => adminNavigationPresetsQueryOptions({ adminUserId });

export const invalidateAfterAdminNavigationChange = async (
  queryClient: QueryClient,
  adminUserId: AdminIdentity,
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminNavigationQueryRoot(adminUserId),
    }),
    invalidateMiddlewareConfig(queryClient),
  ]);
};

const INVALID_INPUT: AdminMutationResult<never> = {
  error: { status: 400 },
};

export const useAdminNavigationMutations = (): {
  onDelete: NavigationAdminListProps["onDelete"];
  onReorder: NavigationAdminListProps["onReorder"];
  onSave: AdminNavigationFormProps["onSave"];
} => {
  const queryClient = useQueryClient();
  const adminUserId = useAdminIdentity();

  return React.useMemo(() => {
    const settle = async <T>(
      result: AdminMutationResult<T>,
    ): Promise<AdminMutationResult<T>> => {
      if ("data" in result) {
        await invalidateAfterAdminNavigationChange(queryClient, adminUserId);
      }

      return result;
    };

    return {
      onDelete: async id => await settle(await deleteAdminNavigation(id)),
      onReorder: async body => await settle(await reorderAdminNavigation(body)),
      onSave: async ({ id, values }) => {
        const texts = {
          description: values.description,
          icon: values.icon === "" ? null : values.icon,
          isOpenInNewTab: values.isOpenInNewTab,
          title: values.title,
        };

        if (id !== undefined) {
          return await settle(
            await updateAdminNavigation(id, {
              ...texts,
              ...(values.kind === "custom" ? { href: values.href } : {}),
            }),
          );
        }

        if (values.kind === "custom") {
          return await settle(
            await createAdminNavigation({
              ...texts,
              href: values.href,
              kind: "custom",
            }),
          );
        }

        const preset = parseNavigationPresetKey(values.preset);
        if (!preset) return INVALID_INPUT;

        return await settle(
          await createAdminNavigation({ ...texts, ...preset, kind: "preset" }),
        );
      },
    };
  }, [adminUserId, queryClient]);
};
