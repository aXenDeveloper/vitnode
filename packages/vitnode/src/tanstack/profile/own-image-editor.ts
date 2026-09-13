import { useQuery, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import type { UserImageEditor } from "@/views/profile/images/types";

import {
  removeOwnUserImage,
  uploadOwnUserImage,
  userImagePolicyQueryOptions,
} from "@/views/profile/images/self-images-query";

import { invalidateSession } from "../auth/session-query";

export const useOwnUserImageEditor = ({
  enabled = true,
  refresh,
}: {
  enabled?: boolean;
  refresh?: () => Promise<void>;
} = {}): undefined | UserImageEditor => {
  const t = useTranslations("core.profile.images");
  const queryClient = useQueryClient();
  const { data: policy } = useQuery({
    ...userImagePolicyQueryOptions(),
    enabled,
  });

  const settle = React.useCallback(async () => {
    await Promise.all([invalidateSession(queryClient), refresh?.()]);
  }, [queryClient, refresh]);

  return React.useMemo(() => {
    if (!enabled || !policy) return undefined;

    return {
      onRemove: async kind => {
        await removeOwnUserImage(kind);
        await settle();
        toast.success(t(`${kind}.removed`), { description: t("removedDesc") });
      },
      onUpload: async (kind, file) => {
        await uploadOwnUserImage(kind, file);
        await settle();
        toast.success(t(`${kind}.uploaded`), {
          description: t("uploadedDesc"),
        });
      },
      policy,
    };
  }, [enabled, policy, settle, t]);
};
