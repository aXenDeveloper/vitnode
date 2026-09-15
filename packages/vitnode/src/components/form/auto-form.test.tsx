import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "use-intl";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import messages from "@/locales/en.json";

import type { FormMode } from "../ui/form";
import type { AutoFormOnSubmit, ItemAutoFormComponentProps } from "./auto-form";

import { setFormFieldError } from "../ui/form";
import { AutoForm } from "./auto-form";
import { AutoFormArray } from "./fields/array";
import { AutoFormInput } from "./fields/input";
import { AutoFormNumber } from "./fields/number";

const settled = async (interaction: () => void) => {
  await act(async () => {
    interaction();
    await Promise.resolve();
  });
};

const errorsShown = () =>
  Array.from(document.querySelectorAll("[data-slot=field-error]")).map(
    node => node.textContent,
  );

const submitButton = () =>
  screen.getAllByRole<HTMLButtonElement>("button", {
    name: /submit|publish/i,
  })[0];

const nameInput = () =>
  screen.getByRole<HTMLInputElement>("textbox", { name: "Name" });

const type = async (input: HTMLInputElement, value: string) => {
  await settled(() => {
    fireEvent.change(input, { target: { value } });
  });
};

const nameSchema = z.object({
  name: z.string().min(3, "Too short").default(""),
});

const renderNameForm = (props: {
  mode?: FormMode;
  onSubmit?: AutoFormOnSubmit<typeof nameSchema>;
}) => {
  render(
    <IntlProvider locale="en" messages={messages}>
      <AutoForm
        fields={[
          {
            id: "name",
            component: fieldProps => (
              <AutoFormInput label="Name" {...fieldProps} />
            ),
          },
        ]}
        formSchema={nameSchema}
        mode={props.mode}
        onSubmit={props.onSubmit}
      />
    </IntlProvider>,
  );
};

describe("AutoForm", () => {
  it("refuses submission until the values satisfy the schema", async () => {
    renderNameForm({});

    expect(submitButton().disabled).toBe(true);
    expect(errorsShown()).toEqual([]);

    await type(nameInput(), "ab");
    expect(submitButton().disabled).toBe(true);

    await type(nameInput(), "abc");
    expect(submitButton().disabled).toBe(false);
  });

  it("keeps a refusal to itself until the form has been submitted", async () => {
    renderNameForm({});

    await type(nameInput(), "ab");
    expect(errorsShown()).toEqual([]);

    await type(nameInput(), "abc");
    await settled(() => {
      submitButton().click();
    });
    await type(nameInput(), "ab");

    expect(errorsShown()).toEqual(["Too short"]);
  });

  it('says so while it is being typed when the form asks for "all"', async () => {
    renderNameForm({ mode: "all" });

    await type(nameInput(), "ab");

    expect(errorsShown()).toEqual(["Too short"]);
  });

  it("hands the submit handler the parsed values and the button's intent", async () => {
    const onSubmit = vi.fn();
    render(
      <IntlProvider locale="en" messages={messages}>
        <AutoForm
          fields={[
            {
              id: "name",
              component: fieldProps => (
                <AutoFormInput label="Name" {...fieldProps} />
              ),
            },
          ]}
          formSchema={nameSchema}
          onSubmit={onSubmit}
          submitButtonProps={{ value: "publish" }}
        />
      </IntlProvider>,
    );

    await type(nameInput(), "Verified");
    await settled(() => {
      submitButton().click();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [values, , options] = onSubmit.mock.calls[0] as [
      unknown,
      unknown,
      { captchaToken: string; intent?: string },
    ];
    expect(values).toEqual({ name: "Verified" });
    expect(options.intent).toBe("publish");
  });

  it("holds a refusal the server named until that field is edited", async () => {
    renderNameForm({
      onSubmit: (_values, form) => {
        setFormFieldError(form, "name", "Already taken");
      },
    });

    await type(nameInput(), "Verified");
    await settled(() => {
      submitButton().click();
    });

    expect(errorsShown()).toEqual(["Already taken"]);
    expect(submitButton().disabled).toBe(true);

    await type(nameInput(), "Verified2");

    expect(errorsShown()).toEqual([]);
    expect(submitButton().disabled).toBe(false);
  });
});

describe("AutoFormArray", () => {
  const featuresSchema = z.object({
    features: z
      .array(z.object({ name: z.string().min(1, "Required").default("") }))
      .default([]),
  });

  const renderFeatures = (
    onSubmit: AutoFormOnSubmit<typeof featuresSchema>,
  ) => {
    render(
      <IntlProvider locale="en" messages={messages}>
        <AutoForm
          fields={[
            {
              id: "features",
              component: fieldProps => (
                <AutoFormArray
                  {...fieldProps}
                  addButtonLabel="Add feature"
                  fields={[
                    {
                      id: "name",
                      component: subProps => (
                        <AutoFormInput label="Feature" {...subProps} />
                      ),
                    },
                  ]}
                  label="Features"
                />
              ),
            },
          ]}
          formSchema={featuresSchema}
          onSubmit={onSubmit}
        />
      </IntlProvider>,
    );
  };

  const rows = () =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name^="features["]'),
    );

  it("adds and removes rows, and submits them in order", async () => {
    const onSubmit = vi.fn();
    renderFeatures(onSubmit);

    const add = screen.getByRole("button", { name: "Add feature" });
    await settled(() => {
      add.click();
    });
    await settled(() => {
      add.click();
    });

    expect(rows().map(input => input.name)).toEqual([
      "features[0].name",
      "features[1].name",
    ]);

    await type(rows()[0], "first");
    await type(rows()[1], "second");

    await settled(() => {
      submitButton().click();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({
      features: [{ name: "first" }, { name: "second" }],
    });

    await settled(() => {
      screen.getAllByRole("button", { name: "Remove" })[0].click();
    });

    expect(rows()).toHaveLength(1);
    expect(rows()[0].value).toBe("second");
  });

  const amountsSchema = z.object({
    amounts: z
      .array(z.object({ value: z.number().nullable().default(null) }))
      .default([]),
  });

  const renderAmounts = () => {
    render(
      <IntlProvider locale="en" messages={messages}>
        <AutoForm
          fields={[
            {
              id: "amounts",
              component: fieldProps => (
                <AutoFormArray
                  {...fieldProps}
                  addButtonLabel="Add amount"
                  fields={[
                    {
                      id: "value",
                      component: subProps => (
                        <AutoFormNumber label="Amount" {...subProps} />
                      ),
                    },
                  ]}
                  label="Amounts"
                />
              ),
            },
          ]}
          formSchema={amountsSchema}
          onSubmit={vi.fn()}
        />
      </IntlProvider>,
    );
  };

  const amounts = () =>
    Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name^="amounts["]'),
    );

  it("keeps the state a row's control owns when an earlier row is removed", async () => {
    renderAmounts();

    const add = screen.getByRole("button", { name: "Add amount" });
    for (const _ of [0, 1, 2]) {
      await settled(() => {
        add.click();
      });
    }

    await type(amounts()[0], "1");
    await type(amounts()[1], "2");
    await type(amounts()[2], "3");

    await settled(() => {
      screen.getAllByRole("button", { name: "Remove" })[1].click();
    });

    expect(amounts().map(input => input.value)).toEqual(["1", "3"]);
  });
});

describe("field props", () => {
  it("omits children entirely when a field has no nested fields", async () => {
    const received: ItemAutoFormComponentProps[] = [];

    await settled(() => {
      render(
        <IntlProvider locale="en" messages={messages}>
          <AutoForm
            fields={[
              {
                id: "name",
                component: fieldProps => {
                  received.push(fieldProps);

                  return <AutoFormInput label="Name" {...fieldProps} />;
                },
              },
            ]}
            formSchema={nameSchema}
            onSubmit={() => {}}
          />
        </IntlProvider>,
      );
    });

    expect(received.length).toBeGreaterThan(0);
    expect(received.every(props => !("children" in props))).toBe(true);
  });
});
