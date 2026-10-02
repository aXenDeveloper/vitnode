import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  Cascader,
  cascaderColumns,
  type CascaderOption,
  findCascaderPath,
  searchCascader,
} from "./cascader";

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

  it("marks the open branch as expanded in the columns layout", async () => {
    render(<Cascader layout="columns" options={places} />);

    openCascader();
    const europe = await screen.findByRole("option", { name: "Europe" });
    expect(europe.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(europe);
    expect(europe.getAttribute("aria-expanded")).toBe("true");
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
});
