import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ItemAutoFormComponentProps } from "./auto-form";

import { LanguagesProvider } from "../languages-provider";
import { AutoForm } from "./auto-form";
import { AutoFormLabel } from "./common/label";
import { AutoFormArray } from "./fields/array";
import { AutoFormCheckbox } from "./fields/checkbox";
import { AutoFormInput } from "./fields/input";
import { multiLangValueSchema } from "./fields/multi-lang";
import { AutoFormSwitch } from "./fields/switch";

const TIP_NAME = /core\.global\.field_tip/;

const tipButtons = () => screen.queryAllByRole("button", { name: TIP_NAME });

const languages = [
  { code: "en", name: "English" },
  { code: "pl", name: "Polski" },
];

describe("AutoForm field tips", () => {
  beforeEach(() => {
    // Reduced motion skips the shake, which needs the Web Animations API the
    // test DOM does not have.
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: vi.fn(),
      matches: true,
      media: query,
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { name: "no tip", tip: undefined },
    { name: "an empty tip", tip: "" },
  ])("renders no help button for $name", ({ tip }) => {
    render(
      <AutoForm
        fields={[
          {
            id: "title",
            component: props => (
              <AutoFormInput {...props} label="Title" tip={tip} />
            ),
          },
        ]}
        formSchema={z.object({ title: z.string().default("") })}
      />,
    );

    expect(tipButtons()).toHaveLength(0);
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDefined();
  });

  it("opens the tip on click and closes it on Escape", async () => {
    const { container } = render(
      <AutoForm
        fields={[
          {
            id: "title",
            component: props => (
              <AutoFormInput
                {...props}
                label="Title"
                tip="Shown in search results"
              />
            ),
          },
        ]}
        formSchema={z.object({ title: z.string().default("") })}
      />,
    );

    const button = screen.getByRole("button", {
      name: "core.global.field_tip Title",
    });
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDefined();
    expect(container.querySelector("[tip]")).toBeNull();

    fireEvent.click(button);
    const popup = await screen.findByRole("dialog");
    expect(popup.textContent).toBe("Shown in search results");

    fireEvent.keyDown(popup, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Shown in search results")).toBeNull();
    });
  });

  it.each([
    {
      name: "checkbox",
      role: "checkbox",
      component: AutoFormCheckbox,
    },
    {
      name: "switch",
      role: "switch",
      component: AutoFormSwitch,
    },
  ])(
    "clicking the help button of a $name neither submits nor toggles it",
    async ({ component: Component, role }) => {
      const onSubmit = vi.fn();
      render(
        <AutoForm
          fields={[
            {
              id: "agree",
              component: props => (
                <Component {...props} label="Agree" tip="Read the terms" />
              ),
            },
          ]}
          formSchema={z.object({ agree: z.boolean().default(false) })}
          onSubmit={onSubmit}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: TIP_NAME }));
      await screen.findByRole("dialog");

      expect(onSubmit).not.toHaveBeenCalled();
      expect(
        screen.getByRole(role, { name: "Agree" }).getAttribute("aria-checked"),
      ).toBe("false");
    },
  );

  // A custom control may not mark itself `aria-invalid`, so the form falls
  // back to the field's first focusable element - which must not be the tip.
  it.each([
    {
      name: "a built-in input",
      component: (props: ItemAutoFormComponentProps) => (
        <AutoFormInput {...props} label="Title" tip="At least 3 letters" />
      ),
    },
    {
      name: "a custom control",
      component: ({ field }: ItemAutoFormComponentProps) => (
        <>
          <AutoFormLabel tip="At least 3 letters">Title</AutoFormLabel>
          <input
            aria-label="Title"
            onChange={event => field.onChange(event.target.value)}
            value={String(field.value ?? "")}
          />
        </>
      ),
    },
  ])(
    "focuses $name, not its help button, after a failed submit",
    async ({ component }) => {
      const onSubmit = vi.fn();
      render(
        <AutoForm
          fields={[{ id: "title", component }]}
          formSchema={z.object({ title: z.string().min(3).default("") })}
          onSubmit={onSubmit}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: "core.global.submit" }),
      );

      const input = screen.getByRole("textbox", { name: "Title" });
      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("renders one help button for a multi-language field, not one per language", () => {
    render(
      <LanguagesProvider languages={languages}>
        <AutoForm
          fields={[
            {
              id: "title",
              component: props => (
                <AutoFormInput
                  {...props}
                  label="Title"
                  multiLang
                  tip="Translate it too"
                />
              ),
            },
          ]}
          formSchema={z.object({ title: multiLangValueSchema().default([]) })}
        />
      </LanguagesProvider>,
    );

    expect(tipButtons()).toHaveLength(1);
  });

  it("keeps the array's own tip and its row tips, and names the group by its label only", () => {
    render(
      <AutoForm
        fields={[
          {
            id: "links",
            component: props => (
              <AutoFormArray
                {...props}
                fields={[
                  {
                    id: "url",
                    component: rowProps => (
                      <AutoFormInput
                        {...rowProps}
                        label="URL"
                        tip="Full address"
                      />
                    ),
                  },
                ]}
                label="Links"
                tip="Shown in the footer"
              />
            ),
          },
        ]}
        formSchema={z.object({
          links: z.array(z.object({ url: z.string() })).default([{ url: "" }]),
        })}
      />,
    );

    expect(tipButtons()).toHaveLength(2);
    expect(screen.getByRole("group", { name: "Links" }).tagName).toBe(
      "FIELDSET",
    );
  });
});
