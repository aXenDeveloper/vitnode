import { fetcherClient } from "@/lib/fetcher-client";
import { manifest } from "@/manifest";

export interface UpdatePrivacyResult {
  data?: true;
  error?: { status: number };
}

export type UpdatePrivacy = (input: {
  hideOnlineStatus: boolean;
}) => Promise<UpdatePrivacyResult>;

export const updatePrivacyInBrowser: UpdatePrivacy = async input => {
  try {
    const response = await fetcherClient({
      plugin: manifest.id,
      args: { body: input },
      method: "put",
      module: "users",
      path: "/me/privacy",
    });

    return response.ok
      ? { data: true }
      : { error: { status: response.status } };
  } catch {
    return { error: { status: 500 } };
  }
};
