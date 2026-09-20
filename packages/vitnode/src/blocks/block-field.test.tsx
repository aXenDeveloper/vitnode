import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  BlockInlineFieldRequest,
  BlockInlineRuntime,
} from "./inline-context";

import { field } from "../content/fields";
import { BlockField, blockFieldsFor } from "./block-field";
import { BlockInlineContext } from "./inline-context";

const heroFields = {
  description: field.textarea({ nullable: true }),
  title: field.text({ maxLength: 200, required: true }),
};

interface RecordingRuntime {
  calls: BlockInlineFieldRequest[];
  runtime: BlockInlineRuntime;
}

const recordingRuntime = (): RecordingRuntime => {
  const calls: BlockInlineFieldRequest[] = [];

  return {
    calls,
    runtime: {
      render: request => {
        calls.push(request);

        return (
          <span data-field={request.name} data-hint={request.placeholder}>
            {request.children}
          </span>
        );
      },
    },
  };
};

describe("a block field on a page nobody is editing", () => {
  it("renders its children and adds no element of its own", () => {
    const bare = render(<h1>Hello</h1>);
    const wrapped = render(
      <BlockField name="title">
        <h1>Hello</h1>
      </BlockField>,
    );

    expect(wrapped.container.innerHTML).toBe(bare.container.innerHTML);
  });

  it("leaves nothing editable behind", () => {
    const { container } = render(
      <BlockField name="title">
        <h1>Hello</h1>
      </BlockField>,
    );

    expect(container.querySelector("[contenteditable]")).toBeNull();
    expect(container.innerHTML).not.toContain("contenteditable");
  });
});

describe("a block field with an inline runtime in context", () => {
  it("hands the request over and renders whatever comes back", () => {
    const { calls, runtime } = recordingRuntime();
    const children = <h1>Hello</h1>;

    render(
      <BlockInlineContext value={runtime}>
        <BlockField name="title" placeholder="Add a title">
          {children}
        </BlockField>
      </BlockInlineContext>,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("title");
    expect(calls[0].placeholder).toBe("Add a title");
    expect(calls[0].children).toBe(children);

    const drawn = screen.getByText("Hello");

    expect(drawn.tagName).toBe("H1");
    expect(drawn.parentElement?.dataset.field).toBe("title");
    expect(drawn.parentElement?.dataset.hint).toBe("Add a title");
  });

  it("passes no placeholder on when the block declares none", () => {
    const { calls, runtime } = recordingRuntime();

    render(
      <BlockInlineContext value={runtime}>
        <BlockField name="title">
          <h1>Hello</h1>
        </BlockField>
      </BlockInlineContext>,
    );

    expect(calls[0].placeholder).toBeUndefined();
  });

  it("draws the same field name twice, each occurrence on its own", () => {
    const { calls, runtime } = recordingRuntime();

    render(
      <BlockInlineContext value={runtime}>
        <BlockField name="title">
          <h1>Top</h1>
        </BlockField>
        <BlockField name="title">
          <h2>Bottom</h2>
        </BlockField>
      </BlockInlineContext>,
    );

    expect(calls.map(request => request.name)).toStrictEqual([
      "title",
      "title",
    ]);
    expect(screen.getByText("Top").tagName).toBe("H1");
    expect(screen.getByText("Bottom").tagName).toBe("H2");
  });
});

describe("the field map a block author opts into", () => {
  it("hands back the very same component, only narrower", () => {
    expect(blockFieldsFor<typeof heroFields>()).toBe(BlockField);
  });

  it("renders identically with nobody editing", () => {
    const Field = blockFieldsFor<typeof heroFields>();
    const bare = render(<h1>Hello</h1>);
    const wrapped = render(
      <Field name="title">
        <h1>Hello</h1>
      </Field>,
    );

    expect(wrapped.container.innerHTML).toBe(bare.container.innerHTML);
  });

  it("goes through the runtime exactly like the plain component", () => {
    const { calls, runtime } = recordingRuntime();
    const Field = blockFieldsFor<typeof heroFields>();

    render(
      <BlockInlineContext value={runtime}>
        <Field name="title">
          <h1>Top</h1>
        </Field>
        <Field name="description" placeholder="Say more">
          <p>Lead</p>
        </Field>
      </BlockInlineContext>,
    );

    expect(calls.map(request => request.name).toSorted()).toStrictEqual(
      Object.keys(heroFields).toSorted(),
    );
    expect(screen.getByText("Lead").parentElement?.dataset.field).toBe(
      "description",
    );
    expect(screen.getByText("Lead").parentElement?.dataset.hint).toBe(
      "Say more",
    );
  });
});
