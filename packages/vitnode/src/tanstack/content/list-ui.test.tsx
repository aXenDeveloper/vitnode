import {
  act,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentListResults, useContentListSearchInput } from "./list-ui";

interface Post {
  id: number;
  title: string;
}

const results = (
  props: Partial<React.ComponentProps<typeof ContentListResults<Post>>>,
) => (
  <ContentListResults<Post>
    empty={<p>empty</p>}
    error={<p>error</p>}
    getKey={post => post.id}
    isFiltered={false}
    items={undefined}
    label="Posts"
    loading={<p>loading</p>}
    noResults={<p>noResults</p>}
    renderItem={post => post.title}
    {...props}
  />
);

describe("ContentListResults", () => {
  it.each<
    [string, Partial<React.ComponentProps<typeof ContentListResults<Post>>>]
  >([
    ["loading", {}],
    ["error", { isError: true }],
    ["empty", { items: [] }],
    ["noResults", { isFiltered: true, items: [] }],
  ])("renders %s", (state, props) => {
    const { container } = render(results(props));

    expect(container.textContent).toBe(state);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it.each([true, false])(
    "renders each item in a named list (isFetching: %s)",
    isFetching => {
      render(
        results({
          isFetching,
          items: [
            { id: 1, title: "Hello" },
            { id: 2, title: "World" },
          ],
        }),
      );

      const list = screen.getByRole("list", { name: "Posts" });
      expect(
        within(list)
          .getAllByRole("listitem")
          .map(item => item.textContent),
      ).toStrictEqual(["Hello", "World"]);
      expect(list.getAttribute("aria-busy")).toBe(String(isFetching));
    },
  );
});

describe("useContentListSearchInput", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = (value: string | undefined) => {
    const onCommit = vi.fn<(term: string | undefined) => void>();
    const hook = renderHook(
      ({ value }: { value: string | undefined }) =>
        useContentListSearchInput({ delay: 500, onCommit, value }),
      { initialProps: { value } },
    );

    return { ...hook, onCommit };
  };

  it("commits the trimmed term once typing pauses", () => {
    const { onCommit, result } = setup(undefined);

    act(() => result.current.setValue("vi"));
    act(() => result.current.setValue(" vite "));
    act(() => vi.advanceTimersByTime(499));
    expect(onCommit).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("vite");
  });

  it("commits a cleared field as undefined", () => {
    const { onCommit, result } = setup("vite");

    act(() => result.current.setValue("   "));
    act(() => vi.advanceTimersByTime(500));

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it("commits at once with commit()", () => {
    const { onCommit, result } = setup(undefined);

    act(() => result.current.setValue("vite"));
    act(() => result.current.commit());

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("vite");
    act(() => vi.advanceTimersByTime(500));
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("follows a term the URL changes on its own", () => {
    const { rerender, result } = setup("vite");

    rerender({ value: "react" });
    expect(result.current.value).toBe("react");

    rerender({ value: undefined });
    expect(result.current.value).toBe("");
  });

  it("keeps a trailing space when the URL catches up with the typed term", () => {
    const { rerender, result } = setup(undefined);

    act(() => result.current.setValue("vite "));
    act(() => vi.advanceTimersByTime(500));
    rerender({ value: "vite" });

    expect(result.current.value).toBe("vite ");
  });
});
