// @vitest-environment node
import type { QueryClient } from "@tanstack/react-query";

import { isNotFound } from "@tanstack/react-router";
import { createTranslator } from "use-intl";
import { describe, expect, it } from "vitest";

import type { UserProfile } from "@/views/profile/profile-query";

import { ProfileRequestError } from "@/views/profile/profile-query";

import { loadProfileRoute } from "./route";

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

/**
 * The translator the runtime hands a loader, over the namespaces the route
 * declared. The loader no longer fetches messages itself, so the fake client
 * below answers only for the profile.
 */
const t = createTranslator({ locale: "en", messages }) as unknown as (
  key: string,
  values?: Record<string, unknown>,
) => string;

const clientAnswering = (
  answer: () => Promise<UserProfile>,
): { queryClient: QueryClient; requested: unknown[][] } => {
  const requested: unknown[][] = [];

  return {
    queryClient: {
      query: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
        requested.push([...queryKey]);

        return await answer();
      },
    } as unknown as QueryClient,
    requested,
  };
};

const load = async (nameCode: string, answer: () => Promise<UserProfile>) => {
  const { queryClient, requested } = clientAnswering(answer);
  const data = await loadProfileRoute({ nameCode, queryClient, t });

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
        loadProfileRoute({ nameCode, queryClient, t }),
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
      loadProfileRoute({ nameCode: "nobody", queryClient, t }),
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
        loadProfileRoute({ nameCode: "aXen", queryClient, t }),
      ).rejects.toBe(error);
    },
  );
});

describe("a profile that exists", () => {
  /**
   * One read, not two: the route's strings are declared in `routes.tsx` and
   * warmed by the runtime before this runs, so the loader fetches the profile
   * and nothing else.
   */
  it("fetches the profile and nothing else", async () => {
    const { requested } = await load(
      "aXen",
      async () => await Promise.resolve(profile),
    );

    expect(requested).toEqual([["vitnode", "profile", "aXen"]]);
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
