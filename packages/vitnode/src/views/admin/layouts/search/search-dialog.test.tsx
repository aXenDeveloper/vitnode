import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminSearchUser } from "./search-users.action.server";

import { MIN_USERS_QUERY_LENGTH } from "./constants";
import { SearchAdminDialog } from "./search-dialog";
import { searchUsersForAdminPalette } from "./search-users.action.server";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/navigation", () => ({
  Link: (props: React.ComponentProps<"a">) => <a {...props} />,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

vi.mock("@/components/staff-permission/provider", () => ({
  useAdminStaffPermission: () => true,
}));

vi.mock("./search-users.action.server", () => ({
  searchUsersForAdminPalette: vi.fn(),
}));

/** `cmdk` measures its list and scrolls the active row into view. */
vi.stubGlobal(
  "ResizeObserver",
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);
Element.prototype.scrollIntoView = vi.fn();

const buildUser = (name: string, id: number): AdminSearchUser => ({
  id,
  name,
  nameCode: name.toLowerCase().replaceAll(" ", "_"),
  email: `${id}@vitnode.com`,
  avatarColor: "3b82f6",
});

const USERS_BY_QUERY: Record<string, AdminSearchUser[]> = {
  john: [buildUser("John Doe", 1)],
  johnny: [buildUser("Johnny Cash", 2)],
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });

  return { promise, resolve };
};

const renderDialog = () =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false } },
        })
      }
    >
      <SearchAdminDialog items={[]} onOpenChange={vi.fn()} open />
    </QueryClientProvider>,
  );

/** Types into the palette, which debounces before the users query runs. */
const typeQuery = (value: string) => {
  fireEvent.change(screen.getByPlaceholderText("search.placeholder"), {
    target: { value },
  });
};

const mockedSearchUsers = vi.mocked(searchUsersForAdminPalette);

const searchedQueries = () =>
  mockedSearchUsers.mock.calls.map(([search]) => search);

describe("SearchAdminDialog users results", () => {
  beforeEach(() => {
    mockedSearchUsers.mockImplementation(
      async search => await Promise.resolve(USERS_BY_QUERY[search] ?? []),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists users once the query reaches the threshold", async () => {
    renderDialog();

    typeQuery("john");

    expect(await screen.findByText("John Doe")).toBeDefined();
    expect(searchedQueries()).toStrictEqual(["john"]);
  });

  it("drops the retained users when the query is shortened below the threshold", async () => {
    renderDialog();

    typeQuery("john");
    expect(await screen.findByText("John Doe")).toBeDefined();

    // Deleting back under the threshold only *disables* the users query, so
    // `keepPreviousData` used to hand the finished search's users to that
    // disabled query - leaving people who no longer match listed and
    // selectable for as long as the palette stayed open.
    typeQuery("jo");

    await waitFor(() => {
      expect(screen.queryByText("John Doe")).toBeNull();
    });
    // The palette asks for more characters instead of showing stale people.
    expect(screen.getByText("search.hint")).toBeDefined();
    expect(searchedQueries()).toStrictEqual(["john"]);
  });

  it("drops the retained users when the query is cleared", async () => {
    renderDialog();

    typeQuery("john");
    expect(await screen.findByText("John Doe")).toBeDefined();

    typeQuery("");

    await waitFor(() => {
      expect(screen.queryByText("John Doe")).toBeNull();
    });
    // An empty palette shows neither the users nor the threshold hint.
    expect(screen.queryByText("search.hint")).toBeNull();
    expect(screen.getByText("results_not_found")).toBeDefined();
    expect(searchedQueries()).toStrictEqual(["john"]);
  });

  it("keeps the previous users while a longer query is still fetching", async () => {
    const pending = deferred<AdminSearchUser[]>();

    renderDialog();

    typeQuery("john");
    expect(await screen.findByText("John Doe")).toBeDefined();

    mockedSearchUsers.mockImplementationOnce(async () => await pending.promise);
    typeQuery("johnny");

    await waitFor(() => {
      expect(searchedQueries()).toStrictEqual(["john", "johnny"]);
    });
    // Still above the threshold, so the retained results bridge the refetch
    // rather than flashing an empty palette.
    expect(screen.getByText("John Doe")).toBeDefined();

    pending.resolve(USERS_BY_QUERY.johnny);

    expect(await screen.findByText("Johnny Cash")).toBeDefined();
    expect(screen.queryByText("John Doe")).toBeNull();
  });

  it("never queries below the threshold in the first place", async () => {
    renderDialog();

    typeQuery("johnny".slice(0, MIN_USERS_QUERY_LENGTH - 1));

    await waitFor(() => {
      expect(screen.getByText("search.hint")).toBeDefined();
    });
    expect(mockedSearchUsers).not.toHaveBeenCalled();
  });
});
