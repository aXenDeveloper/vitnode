"use client";

import { useRouter } from "@/lib/navigation";
import { ErrorViewActions } from "@/views/error/error-view";

import type { SSOProvider } from "../../providers";

import { NextAuthLink } from "../../../next-link";
import { SSOCallbackContent } from "../sso-callback-content";
import { useSSOCallback } from "../use-sso-callback";
import { mutationApi } from "./mutation-api.server";

/**
 * {@link SSOCallbackContent}, wired to Next.js.
 *
 * The exchange and the four screens it can end on are shared; the three things
 * that are not live here. The server action that trades the authorization code
 * for a session and revalidates the layout it is rendered into, the router that
 * takes the visitor to the front page once it worked, and the two navigation
 * buttons the generic error screens end with.
 */
export const ClientCallbackSSO = ({
  code,
  oauthError,
  oauthState,
  providerId,
  providers,
}: {
  code: string;
  oauthError?: string;
  oauthState: string;
  providerId: string;
  providers: readonly SSOProvider[];
}) => {
  const { replace } = useRouter();
  const state = useSSOCallback({
    code,
    oauthError,
    onCallback: async () =>
      await mutationApi({ code, providerId, state: oauthState }),
    onSignedIn: () => {
      replace("/");
    },
    providerId,
  });

  return (
    <SSOCallbackContent
      errorActions={<ErrorViewActions />}
      LinkComponent={NextAuthLink}
      providerId={providerId}
      providers={providers}
      state={state}
    />
  );
};
