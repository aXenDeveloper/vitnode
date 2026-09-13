// @vitest-environment node
import type { QueryClient } from "@tanstack/react-query";

import { isNotFound } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import type { UserProfile } from "@/views/profile/profile-query";

import { ProfileRequestError } from "@/views/profile/profile-query";

import { loadProfileRoute, PROFILE_NAMESPACES } from "./route";

const profile: UserProfile = {
  avatarColor: "3b82f6",
  avatarUrl: null,
  coverUrl: null,
  createdAt: "2025-11-15T12:18:00.109Z",
  headline: null,
  id: 1,
  name: "aXen",
  nameCode: "aXen",
  role: { color: null, id: 4, name: [], prefix: null },
  secondaryRoles: [],
};

const messages = {
  core: {
    profile: {
      metaDesc: "See {name}'s profile (@{nameCode}).",
      title: "{name}'s profile",
    },
  },
};

const isIntlKey = (queryKey: readonly unknown[]) =>
  queryKey[0] === "vitnode" && queryKey[1] === "intl";

const clientAnswering = (
  answer: () => Promise<UserProfile>,
): { queryClient: QueryClient; requested: unknown[][] } => {
  const requested: unknown[][] = [];

  return {
    queryClient: {
      query: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        requested.push([...queryKey]);

        if (isIntlKey(queryKey)) return await Promise.resolve({ messages });

        return await answer();
      },
    } as unknown as QueryClient,
    requested,
  };
};

const load = async (nameCode: string, answer: () => Promise<UserProfile>) => {
  const { queryClient, requested } = clientAnswering(answer);
  const data = await loadProfileRoute({ locale: "en", nameCode, queryClient });

  return { data, requested };
};

describe("a handle that cannot be a profile", () => {
  it.each(["", "a/b", "who?", "a".repeat(300)])(
    "is a 404 before anything is fetched: %j",
    async nameCode => {
      const { queryClient, requested } = clientAnswering(
        async () => await Promise.reject(new Error("must not be called")),
      );

      await expect(
        loadProfileRoute({ locale: "en", nameCode, queryClient }),
      ).rejects.toSatisfy(isNotFound);
      expect(requested).toEqual([]);
    },
  );
});

describe("a profile the API does not have", () => {
  it("is the route's not-found, not an error screen", async () => {
    const { queryClient } = clientAnswering(
      async () => await Promise.reject(new ProfileRequestError(404, "nobody")),
    );

    await expect(
      loadProfileRoute({ locale: "en", nameCode: "nobody", queryClient }),
    ).rejects.toSatisfy(isNotFound);
  });

  it.each([429, 502])(
    "propagates %i rather than dressing it as a 404",
    async status => {
      const error = new ProfileRequestError(status, "aXen");
      const { queryClient } = clientAnswering(
        async () => await Promise.reject(error),
      );

      await expect(
        loadProfileRoute({ locale: "en", nameCode: "aXen", queryClient }),
      ).rejects.toBe(error);
    },
  );
});

describe("a profile that exists", () => {
  it("warms the route's strings and the profile together", async () => {
    const { requested } = await load(
      "aXen",
      async () => await Promise.resolve(profile),
    );

    expect(requested).toHaveLength(2);
    expect(requested[0].slice(0, 3)).toEqual(["vitnode", "intl", "en"]);
    expect(requested[0].slice(3)).toEqual([...PROFILE_NAMESPACES]);
    expect(requested[1]).toEqual(["vitnode", "profile", "aXen"]);
  });

  it("titles the page after the member, as the API spells them", async () => {
    const { data } = await load(
      "aXen",
      async () =>
        await Promise.resolve({ ...profile, name: "Maciej", nameCode: "aXen" }),
    );

    expect(data).toEqual({
      description: "See Maciej's profile (@aXen).",
      nameCode: "aXen",
      title: "Maciej's profile",
    });
  });
});
