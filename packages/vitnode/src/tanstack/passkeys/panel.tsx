import { useSuspenseQuery } from "@tanstack/react-query";

import { PasskeysContent } from "@/views/auth/settings/passkeys/passkeys-content";
import { PasskeysListSkeleton } from "@/views/auth/settings/passkeys/passkeys-list-skeleton";
import { passkeysQueryOptions } from "@/views/auth/settings/passkeys/passkeys-query";

import { useMiddlewareConfigQuery } from "../auth/middleware-config";
import { usePasskeyActions } from "./query";

export const PasskeysPanelPending = PasskeysListSkeleton;

export const PasskeysPanelContent = ({ userId }: { userId: number }) => {
  const { data } = useSuspenseQuery(passkeysQueryOptions({ userId }));
  const { data: config } = useMiddlewareConfigQuery();
  const actions = usePasskeyActions(userId);

  return (
    <PasskeysContent
      isPasswordEnabled={config.password}
      passkeys={data.passkeys}
      {...actions}
    />
  );
};
