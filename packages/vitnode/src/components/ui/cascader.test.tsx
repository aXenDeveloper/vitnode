import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Cascader } from "./cascader";
import {
  cascaderColumns,
  type CascaderOption,
  findCascaderPath,
  searchCascader,
} from "./cascader-utils";

const places: CascaderOption[] = [
  {
    children: [
      {
        children: [
          { label: "Warsaw", value: "warsaw" },
          { label: "Kraków", value: "krakow" },
        ],
        label: "Poland",
        value: "poland",
      },
      { label: "Lisbon", value: "lisbon" },
    ],
    label: "Europe",
    value: "europe",
  },
  {
    children: [{ label: "Tokyo", value: "tokyo" }],
    label: "Asia",
    value: "asia",
  },
];

describe("cascader helpers", () => {
  it("finds the path from the root to a value", () => {
    expect(findCascaderPath(places, "krakow").map(node => node.value)).toEqual([
      "europe",
      "poland",
      "krakow",
    ]);
    expect(findCascaderPath(places, "nowhere")).toEqual([]);
  });

  it("opens one column per active branch and stops at a leaf", () => {
    expect(cascaderColumns(places, []).length).toBe(1);
    expect(
      cascaderColumns(places, ["europe", "poland"]).map(column =>
        column.map(node => node.value),
      ),
    ).toEqual([
      ["europe", "asia"],
      ["poland", "lisbon"],
      ["warsaw", "krakow"],
    ]);
    expect(cascaderColumns(places, ["europe", "lisbon"]).length).toBe(2);
  });

  it("searches leaves by any label on their path, ignoring accents", () => {
    expect(
      searchCascader(places, "krakow").map(path => path.at(-1)?.value),
    ).toEqual(["krakow"]);
    expect(
      searchCascader(places, "europe").map(path => path.at(-1)?.value),
    ).toEqual(["warsaw", "krakow", "lisbon"]);
    expect(searchCascader(places, "  ")).toEqual([]);
  });
});

describe("Cascader", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const openCascader = () => {
    fireEvent.click(
      screen.getByRole("button", { name: "core.global.select_option" }),
    );
  };

  it("drills down the columns and selects a leaf", async () => {
    const onValueChange = vi.fn();
    render(<Cascader onValueChange={onValueChange} options={places} />);

    openCascader();
    fireEvent.click(await screen.findByRole("option", { name: "Europe" }));
    fireEvent.click(await screen.findByRole("option", { name: "Poland" }));
    fireEvent.click(await screen.findByRole("option", { name: "Warsaw" }));

    expect(onValueChange).toHaveBeenCalledWith(
      "warsaw",
      expect.arrayContaining([expect.objectContaining({ value: "europe" })]),
    );
    expect(
      screen.getByRole("button", { name: "Europe / Poland / Warsaw" }),
    ).toBeTruthy();
  });

  it("replaces the list with the branch's children and goes back", async () => {
    render(<Cascader options={places} />);

    openCascader();
    fireEvent.click(await screen.findByRole("option", { name: "Europe" }));

    expect(await screen.findByRole("option", { name: "Poland" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Asia" })).toBeNull();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /core\.global\.go_back/ }),
    );

    expect(await screen.findByRole("option", { name: "Asia" })).toBeTruthy();
  });

  it("marks the open branch as current and points it at its column in the columns layout", async () => {
    render(<Cascader layout="columns" options={places} />);

    openCascader();
    const europe = await screen.findByRole("option", { name: "Europe" });
    expect(europe.getAttribute("aria-current")).toBeNull();
    expect(europe.getAttribute("aria-controls")).toBeNull();

    fireEvent.click(europe);

    const column = await screen.findByRole("listbox", { name: "Europe" });
    expect(europe.getAttribute("aria-current")).toBe("true");
    expect(europe.getAttribute("aria-controls")).toBe(column.id);
    expect(europe.hasAttribute("aria-expanded")).toBe(false);
  });

  it("picks a search result straight away", async () => {
    const onValueChange = vi.fn();
    render(
      <Cascader onValueChange={onValueChange} options={places} searchable />,
    );

    openCascader();
    fireEvent.change(
      await screen.findByRole("textbox", {
        name: "core.global.search_placeholder",
      }),
      { target: { value: "tok" } },
    );
    fireEvent.click(
      await screen.findByRole("option", { name: "Asia / Tokyo" }),
    );

    expect(onValueChange).toHaveBeenCalledWith("tokyo", expect.any(Array));
  });

  it("clears the value with the clear button", () => {
    const onValueChange = vi.fn();
    render(
      <Cascader
        defaultValue="lisbon"
        onValueChange={onValueChange}
        options={places}
        showClear
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "core.global.clear" }));

    expect(onValueChange).toHaveBeenCalledWith(null, []);
    expect(
      screen.getByRole("button", { name: "core.global.select_option" }),
    ).toBeTruthy();
  });

  it("moves between enabled options with the arrow keys, skipping disabled ones", async () => {
    render(
      <Cascader
        options={[
          { disabled: true, label: "Closed", value: "closed" },
          { label: "Alpha", value: "alpha" },
          { label: "Beta", value: "beta" },
        ]}
      />,
    );

    openCascader();
    const alpha = await screen.findByRole("option", { name: "Alpha" });
    const beta = screen.getByRole("option", { name: "Beta" });
    alpha.focus();

    fireEvent.keyDown(alpha, { key: "ArrowDown" });
    expect(document.activeElement).toBe(beta);

    fireEvent.keyDown(beta, { key: "ArrowDown" });
    expect(document.activeElement).toBe(beta);

    fireEvent.keyDown(beta, { key: "ArrowUp" });
    expect(document.activeElement).toBe(alpha);
  });

  it("treats an empty string as a selected value", () => {
    render(
      <Cascader
        defaultValue=""
        options={[
          { label: "None", value: "" },
          { label: "Alpha", value: "alpha" },
        ]}
        showClear
      />,
    );

    expect(screen.getByRole("button", { name: "None" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "core.global.clear" }),
    ).toBeTruthy();
  });
});
