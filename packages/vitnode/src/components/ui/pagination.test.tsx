import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination";

const renderPagination = () =>
  render(
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious aria-disabled role="link" />
        </PaginationItem>
        {[1, 2, 3].map(page => (
          <PaginationItem key={page}>
            <PaginationLink href={`?page=${page}`} isActive={page === 1}>
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext href="?page=2" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>,
  );

describe("Pagination", () => {
  it("names every page link by its number", () => {
    renderPagination();

    expect(screen.getByRole("link", { name: "1" }).getAttribute("href")).toBe(
      "?page=1",
    );
    expect(screen.getByRole("link", { name: "2" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "3" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("marks only the active page as current", () => {
    renderPagination();

    expect(
      screen.getByRole("link", { name: "1" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "2" }).hasAttribute("aria-current"),
    ).toBe(false);
  });

  it("labels previous and next with translated text by default", () => {
    renderPagination();

    const next = screen.getByRole("link", {
      name: "core.global.next_page",
    });
    const previous = screen.getByRole("link", {
      name: "core.global.previous_page",
    });

    expect(next.textContent).toBe("core.global.next");
    expect(previous.textContent).toBe("core.global.previous");
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(previous.hasAttribute("href")).toBe(false);
  });

  it("prefers custom previous and next text", () => {
    render(
      <>
        <PaginationPrevious href="?page=1" text="Newer posts" />
        <PaginationNext href="?page=3" text="Older posts" />
      </>,
    );

    expect(
      screen.getByRole("link", { name: "core.global.previous_page" })
        .textContent,
    ).toBe("Newer posts");
    expect(
      screen.getByRole("link", { name: "core.global.next_page" }).textContent,
    ).toBe("Older posts");
  });
});
