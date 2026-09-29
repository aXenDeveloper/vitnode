import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import React from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useSignOutAction } from "../auth/actions";
import { useAdminAccess } from "./permissions";
import { adminSessionCheckDelay } from "./session-expiry";
import { ADMIN_SESSION_QUERY_KEY } from "./state";
import { isAdminSessionStillInUse, keepAdminTabAlive } from "./tab-presence";
import { adminTransport } from "./transport";

export const AdminSessionGuard = () => {
  const access = useAdminAccess();
  const queryClient = useQueryClient();
  const router = useRouter();
  const signOut = useSignOutAction();
  const t = useTranslations("admin.global.session");
  const [checkRound, setCheckRound] = React.useState(0);
  const lastExpiresAtRef = React.useRef<number | undefined>(undefined);
  const expiredByCheckRef = React.useRef(false);
  const leavingRef = React.useRef(false);

  const expiresAt =
    access.status === "granted" ? access.session.expiresAt : undefined;

  const leaveExpiredSession = React.useEffectEvent(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    const expired =
      expiredByCheckRef.current ||
      (lastExpiresAtRef.current !== undefined &&
        Date.now() >= lastExpiresAtRef.current);

    if (expired) {
      toast.info(t("expired.title"), { description: t("expired.desc") });
    }

    await router.invalidate();
  });

  const checkSession = React.useEffectEvent(async () => {
    const read = await adminTransport().readAdminSession({ passive: true });

    if (read.status === "granted") {
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, read);
      setCheckRound(round => round + 1);

      return;
    }

    if (read.status === "denied") {
      expiredByCheckRef.current = true;
      queryClient.setQueryData(ADMIN_SESSION_QUERY_KEY, read);

      return;
    }

    setCheckRound(round => round + 1);
  });

  const leaveAbandonedSession = React.useEffectEvent(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    const result = await signOut({ isAdmin: true });
    if (result.ok) {
      toast.info(t("tabs_closed.title"), {
        description: t("tabs_closed.desc"),
      });
    }
  });

  React.useEffect(() => {
    const presence = {
      mounted: true,
      stopKeepingAlive: (): void => undefined,
    };

    void isAdminSessionStillInUse().then(inUse => {
      if (!presence.mounted) return;

      if (!inUse) {
        void leaveAbandonedSession();

        return;
      }

      presence.stopKeepingAlive = keepAdminTabAlive();
    });

    return () => {
      presence.mounted = false;
      presence.stopKeepingAlive();
    };
  }, []);

  React.useEffect(() => {
    if (access.status === "denied") {
      if (lastExpiresAtRef.current !== undefined) void leaveExpiredSession();

      return;
    }

    if (!expiresAt) return;

    lastExpiresAtRef.current = new Date(expiresAt).getTime();
    const timer = setTimeout(() => {
      void checkSession();
    }, adminSessionCheckDelay(expiresAt));

    return () => {
      clearTimeout(timer);
    };
  }, [access.status, expiresAt, checkRound]);

  return null;
};
