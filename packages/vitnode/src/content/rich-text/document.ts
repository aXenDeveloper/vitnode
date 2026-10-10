import { z } from "zod";

export type RichTextAttrPrimitive = boolean | null | number | string;

export type RichTextAttrValue = RichTextAttrPrimitive | RichTextAttrPrimitive[];

export type RichTextAttrs = Record<string, RichTextAttrValue>;

export interface RichTextMark {
  attrs?: RichTextAttrs;
  type: string;
}

export interface RichTextNode {
  attrs?: RichTextAttrs;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
  type: string;
}

export interface RichTextDocument extends RichTextNode {
  type: "doc";
}

export const RICH_TEXT_MAX_DEPTH = 64;

export const RICH_TEXT_DEFAULT_MAX_BYTES = 1024 * 1024;

export const RICH_TEXT_ABSOLUTE_MAX_BYTES = 16 * 1024 * 1024;

const RICH_TEXT_TYPE_PATTERN = /^[A-Za-z][\w-]{0,63}$/;

const zodType = z
  .string()
  .regex(
    RICH_TEXT_TYPE_PATTERN,
    "A node or mark type is 1-64 letters, digits, hyphens or underscores, starting with a letter.",
  );

const zodAttrPrimitive = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const zodAttrs = z.record(
  z.string().max(64),
  z.union([zodAttrPrimitive, z.array(zodAttrPrimitive).max(1000)]),
);

const zodMark = z.strictObject({
  attrs: zodAttrs.optional(),
  type: zodType,
});

const zodNode: z.ZodType<RichTextNode> = z.strictObject({
  attrs: zodAttrs.optional(),
  get content(): z.ZodOptional<z.ZodArray<z.ZodType<RichTextNode>>> {
    return z.array(zodNode).optional();
  },
  marks: z.array(zodMark).optional(),
  text: z.string().optional(),
  type: zodType,
});

const zodDocumentShape = z.strictObject({
  attrs: zodAttrs.optional(),
  content: z.array(zodNode).optional(),
  type: z.literal("doc"),
});

const utf8Length = (value: string): number =>
  new TextEncoder().encode(value).length;

export const richTextLimitIssue = (
  value: unknown,
  {
    maxBytes = RICH_TEXT_DEFAULT_MAX_BYTES,
    maxDepth = RICH_TEXT_MAX_DEPTH,
  }: { maxBytes?: number; maxDepth?: number } = {},
): null | string => {
  const stack: [unknown, number][] = [[value, 1]];

  for (let entry = stack.pop(); entry; entry = stack.pop()) {
    const [node, depth] = entry;
    if (depth > maxDepth) {
      return `The document nests deeper than ${maxDepth} levels.`;
    }

    if (
      typeof node === "object" &&
      node !== null &&
      "content" in node &&
      Array.isArray(node.content)
    ) {
      for (const child of node.content) stack.push([child, depth + 1]);
    }
  }

  let serialized: string | undefined;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return "The document is not plain JSON.";
  }

  if (serialized !== undefined && utf8Length(serialized) > maxBytes) {
    return `The document is larger than ${maxBytes} bytes.`;
  }

  return null;
};

export interface RichTextSchemaOptions {
  maxBytes?: number;
  maxDepth?: number;
  required?: boolean;
}

export const createRichTextDocumentSchema = ({
  maxBytes = RICH_TEXT_DEFAULT_MAX_BYTES,
  maxDepth = RICH_TEXT_MAX_DEPTH,
  required = false,
}: RichTextSchemaOptions = {}): z.ZodType<RichTextDocument> => {
  const schema = z
    .looseObject({
      content: z.array(z.unknown()).optional(),
      type: z.literal("doc"),
    })
    .superRefine((value, ctx) => {
      const issue = richTextLimitIssue(value, { maxBytes, maxDepth });
      if (issue !== null) ctx.addIssue({ code: "custom", message: issue });
    })
    .pipe(zodDocumentShape);

  return required
    ? schema.refine(doc => !isRichTextEmpty(doc), {
        message: "The document is empty.",
      })
    : schema;
};

export const zodRichTextDocument = createRichTextDocumentSchema();

export const isRichTextDocument = (value: unknown): value is RichTextDocument =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "type" in value &&
  value.type === "doc";

export const emptyRichTextDocument = (): RichTextDocument => ({
  content: [{ type: "paragraph" }],
  type: "doc",
});

const STRUCTURAL_TYPES: ReadonlySet<string> = new Set([
  "blockquote",
  "bulletList",
  "codeBlock",
  "doc",
  "hardBreak",
  "heading",
  "horizontalRule",
  "listItem",
  "orderedList",
  "panel",
  "paragraph",
  "table",
  "tableCell",
  "tableHeader",
  "tableRow",
  "taskItem",
  "taskList",
]);

export const isRichTextEmpty = (
  doc: null | RichTextNode | undefined,
): boolean => {
  if (!doc) return true;

  const stack: RichTextNode[] = [doc];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    if (node.type === "text") {
      if (typeof node.text === "string" && node.text.trim() !== "") {
        return false;
      }
      continue;
    }

    const content = Array.isArray(node.content) ? node.content : [];
    if (content.length === 0 && !STRUCTURAL_TYPES.has(node.type)) return false;

    stack.push(...content);
  }

  return true;
};
