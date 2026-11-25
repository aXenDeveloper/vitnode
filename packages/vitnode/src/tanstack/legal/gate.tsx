import type { QueryClient } from "@tanstack/react-query";

import { useQueryClient } from "@tanstack/react-query";
import { redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { legalChangesChannel } from "@vitnode/api/ws/legal";
import React from "react";

import { TERMS_ACCEPTANCE_REQUIRED_EVENT } from "@/lib/fetcher/terms-acceptance";
import { useVitNodeWebSocket } from "@/ws/use-websocket";

import { RETURN_TO_PARAM } from "../auth/redirects";
import {
  invalidateSession,
  sessionQueryOptions,
  useSessionQuery,
} from "../auth/session-query";

/** The page a member who owes Terms acceptance is sent to. */
export const LEGAL_ACCEPT_PATH = "/legal/accept";

/**
 * Pages that stay open while a member owes Terms acceptance: the acceptance
 * page and the documents themselves, the personal-data and security settings
 * (export, deletion, password, devices) and the sign-in pages. Internal paths,
 * without a locale prefix; each covers everything below it.
 */
export const TERMS_GATE_OPEN_PATHS = [
  "/legal",
  "/terms",
  "/privacy",
  "/settings/privacy",
  "/settings/security",
  "/settings/devices",
  "/login",
] as const;

/** Whether `pathname` (internal) stays open while acceptance is pending. */
export const isTermsGateOpenPath = (pathname: string): boolean =>
  TERMS_GATE_OPEN_PATHS.some(
    path => pathname === path || pathname.startsWith(`${path}/`),
  );

const acceptSearch = (pathname: string) =>
  pathname === "/" ? {} : { [RETURN_TO_PARAM]: pathname };

/**
 * Loader-time gate: a signed-in member who owes Terms acceptance is redirected
 * to {@link LEGAL_ACCEPT_PATH} from any page not in
 * {@link TERMS_GATE_OPEN_PATHS}. Reads the cached session; `loadMainShell`
 * calls it after loading the session.
 */
export const redirectPendingTerms = (
  queryClient: QueryClient,
  pathname: string,
): void => {
  const session = queryClient.getQueryData(sessionQueryOptions().queryKey);
  if (!session?.user?.legal.pendingTerms || isTermsGateOpenPath(pathname)) {
    return;
  }

  // oxlint-disable-next-line typescript/only-throw-error
  throw redirect({
    replace: true,
    search: acceptSearch(pathname),
    to: LEGAL_ACCEPT_PATH,
  });
};

/**
 * Client-side twin of {@link redirectPendingTerms}, for pages rendered without
 * a loader pass (prerendered shells) and for a requirement that appears while
 * a tab is open. Rendered by `MainHeader`.
 */
export const TermsAcceptanceGate = () => {
  const { data } = useSessionQuery();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const blocked =
    !!data?.user?.legal.pendingTerms && !isTermsGateOpenPath(pathname);

  React.useEffect(() => {
    if (!blocked) return;
    void navigate({
      replace: true,
      search: acceptSearch(pathname),
      to: LEGAL_ACCEPT_PATH,
    });
  }, [blocked, navigate, pathname]);

  return null;
};

/** Longest timer a browser schedules reliably (about 24.8 days). */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Keeps the session's legal state current in an open tab: refetches it when
 * the API answers `TERMS_ACCEPTANCE_REQUIRED`, when the server announces that
 * a version took effect, and when the next scheduled version's effective time
 * arrives. Rendered by `RealtimeListeners`.
 */
export const LegalStateSync = () => {
  const queryClient = useQueryClient();
  const { data } = useSessionQuery();
  const nextChangeAt = data?.user?.legal.nextChangeAt ?? null;

  const refresh = React.useCallback(() => {
    void invalidateSession(queryClient);
  }, [queryClient]);

  useVitNodeWebSocket(legalChangesChannel, { onMessage: refresh });

  React.useEffect(() => {
    window.addEventListener(TERMS_ACCEPTANCE_REQUIRED_EVENT, refresh);

    return () => {
      window.removeEventListener(TERMS_ACCEPTANCE_REQUIRED_EVENT, refresh);
    };
  }, [refresh]);

  React.useEffect(() => {
    if (!nextChangeAt) return;
    const delay = Date.parse(nextChangeAt) - Date.now() + 1000;
    if (delay > MAX_TIMEOUT_MS) return;
    const timer = window.setTimeout(refresh, Math.max(delay, 0));

    return () => {
      window.clearTimeout(timer);
    };
  }, [nextChangeAt, refresh]);

  return null;
};
