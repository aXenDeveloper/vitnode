import type {
  ArrayExpression,
  CallExpression,
  Expression,
  ImportDeclaration,
  ObjectExpression,
  ObjectProperty,
  Program,
} from "oxc-parser";

import { parseSync, Visitor } from "oxc-parser";

import { ConfigError } from "../errors";

export interface Edit {
  end: number;
  start: number;
  text: string;
}

export interface ParsedSource {
  path: string;
  program: Program;
  source: string;
}

export const parseSource = (path: string, source: string): ParsedSource => {
  const result = parseSync(path, source, {
    lang: path.endsWith(".tsx") ? "tsx" : "ts",
    sourceType: "module",
  });

  if (result.errors.length > 0) {
    throw new ConfigError(`${path} could not be parsed.`, {
      details: result.errors.slice(0, 3).map(error => error.message),
      hint: "Fix the syntax error first - the generator only edits files it can read.",
    });
  }

  return { path, program: result.program, source };
};

export const applyEdits = (source: string, edits: readonly Edit[]): string =>
  edits
    .map((edit, index) => ({ ...edit, index }))
    .sort((a, b) => b.start - a.start || b.end - a.end || b.index - a.index)
    .reduce(
      (text, edit) =>
        text.slice(0, edit.start) + edit.text + text.slice(edit.end),
      source,
    );

export const findCalls = (
  program: Program,
  callee: string,
): CallExpression[] => {
  const calls: CallExpression[] = [];
  new Visitor({
    CallExpression(call) {
      if (call.callee.type === "Identifier" && call.callee.name === callee) {
        calls.push(call);
      }
    },
  }).visit(program);

  return calls;
};

export const unwrap = (node: Expression): Expression => {
  let current: Expression = node;
  for (;;) {
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSSatisfiesExpression" ||
      current.type === "ParenthesizedExpression" ||
      current.type === "TSNonNullExpression"
    ) {
      current = current.expression;
    } else {
      return current;
    }
  }
};

export const objectArgument = (
  call: CallExpression,
): null | ObjectExpression => {
  const [first] = call.arguments;
  if (first === undefined || first.type === "SpreadElement") return null;
  const value = unwrap(first);

  return value.type === "ObjectExpression" ? value : null;
};

export const getProperty = (
  object: ObjectExpression,
  key: string,
): null | ObjectProperty => {
  for (const property of object.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const name =
      property.key.type === "Identifier"
        ? property.key.name
        : property.key.type === "Literal"
          ? String(property.key.value)
          : null;
    if (name === key) return property;
  }

  return null;
};

export const stringValue = (property: null | ObjectProperty): null | string => {
  if (property === null) return null;
  const value = unwrap(property.value);
  if (value.type === "Literal" && typeof value.value === "string") {
    return value.value;
  }
  if (
    value.type === "TemplateLiteral" &&
    value.expressions.length === 0 &&
    value.quasis.length === 1
  ) {
    return value.quasis[0]?.value.cooked ?? null;
  }

  return null;
};

export const arrayValue = (
  property: null | ObjectProperty,
): ArrayExpression | null => {
  if (property === null) return null;
  const value = unwrap(property.value);

  return value.type === "ArrayExpression" ? value : null;
};

export const objectValue = (
  property: null | ObjectProperty,
): null | ObjectExpression => {
  if (property === null) return null;
  const value = unwrap(property.value);

  return value.type === "ObjectExpression" ? value : null;
};

const lineStart = (source: string, index: number) =>
  source.lastIndexOf("\n", index - 1) + 1;

const startOfLineCommentsAbove = (source: string, lineIndex: number) => {
  let at = lineIndex;
  while (at > 0) {
    const previous = lineStart(source, at - 1);
    if (!source.slice(previous, at).trim().startsWith("//")) break;
    at = previous;
  }

  return at;
};

const indentAt = (source: string, index: number): string =>
  /^[ \t]*/.exec(source.slice(lineStart(source, index)))?.[0] ?? "";

const commaAfter = (source: string, index: number): null | number => {
  const match = /^(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\n]*)*,/.exec(
    source.slice(index),
  );

  return match === null ? null : index + match[0].length;
};

export const appendToArray = (
  source: string,
  array: ArrayExpression,
  text: string,
): Edit[] => {
  const elements = array.elements.filter(
    (element): element is NonNullable<typeof element> => element !== null,
  );
  const last = elements[elements.length - 1];

  if (last === undefined) {
    return insertIntoEmpty(source, array, text);
  }

  const inner = source.slice(array.start, array.end);
  const comma = commaAfter(source, last.end);

  if (!inner.includes("\n")) {
    return comma === null
      ? [{ end: last.end, start: last.end, text: `, ${text}` }]
      : [{ end: comma, start: comma, text: ` ${text}` }];
  }

  const closing = array.end - 1;
  const closingLineStart = lineStart(source, closing);
  const closingOnOwnLine =
    source.slice(closingLineStart, closing).trim() === "";
  const indent = indentAt(source, last.start);
  const edits: Edit[] =
    comma === null ? [{ end: last.end, start: last.end, text: "," }] : [];

  edits.push(
    closingOnOwnLine
      ? {
          end: closingLineStart,
          start: closingLineStart,
          text: `${indent}${text},\n`,
        }
      : { end: closing, start: closing, text: `\n${indent}${text}` },
  );

  return edits;
};

const insertIntoEmpty = (
  source: string,
  node: { end: number; start: number },
  text: string,
): Edit[] => {
  const inner = source.slice(node.start + 1, node.end - 1);
  if (inner.trim() === "") {
    return [{ end: node.end - 1, start: node.start + 1, text }];
  }

  const closing = node.end - 1;
  const closingLineStart = lineStart(source, closing);
  if (source.slice(closingLineStart, closing).trim() === "") {
    return [
      {
        end: closingLineStart,
        start: closingLineStart,
        text: `${indentAt(source, closing)}  ${text},\n`,
      },
    ];
  }

  return [{ end: closing, start: closing, text: ` ${text} ` }];
};

export const addProperty = (
  source: string,
  object: ObjectExpression,
  text: string,
  after?: string,
): Edit[] => {
  const properties = object.properties;
  const anchor =
    (after === undefined ? null : getProperty(object, after)) ??
    properties[properties.length - 1];

  if (anchor === undefined) {
    const inner = source.slice(object.start + 1, object.end - 1);
    if (inner.trim() !== "") return insertIntoEmpty(source, object, text);

    return [
      {
        end: object.end - 1,
        start: object.start + 1,
        text: inner.includes("\n")
          ? `\n${indentAt(source, object.start)}  ${text},\n${indentAt(source, object.start)}`
          : ` ${text} `,
      },
    ];
  }

  const multiline = source.slice(object.start, object.end).includes("\n");
  const comma = commaAfter(source, anchor.end);

  if (!multiline) {
    return comma === null
      ? [{ end: anchor.end, start: anchor.end, text: `, ${text}` }]
      : [{ end: comma, start: comma, text: ` ${text},` }];
  }

  const indent = indentAt(source, anchor.start);
  const from = comma ?? anchor.end;
  const newline = source.indexOf("\n", from);
  const lineEnd =
    newline === -1 || newline > object.end ? object.end - 1 : newline;
  const rest = source.slice(from, lineEnd);
  const at = /^\s*(?:\/\/.*)?$/.test(rest) ? lineEnd : from;
  const edits: Edit[] =
    comma === null ? [{ end: anchor.end, start: anchor.end, text: "," }] : [];
  edits.push({ end: at, start: at, text: `\n${indent}${text},` });

  return edits;
};

export interface ImportInfo {
  declaration: ImportDeclaration;
  isType: boolean;
  locals: { imported: null | string; isType: boolean; local: string }[];
  source: string;
}

export const listImports = (program: Program): ImportInfo[] =>
  program.body.flatMap(statement => {
    if (statement.type !== "ImportDeclaration") return [];

    return [
      {
        declaration: statement,
        isType: statement.importKind === "type",
        locals: statement.specifiers.map(specifier => ({
          imported:
            specifier.type === "ImportSpecifier"
              ? specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value
              : null,
          isType:
            statement.importKind === "type" ||
            (specifier.type === "ImportSpecifier" &&
              specifier.importKind === "type"),
          local: specifier.local.name,
        })),
        source: statement.source.value,
      },
    ];
  });

export const topLevelNames = (program: Program): Set<string> => {
  const names = new Set<string>();

  for (const info of listImports(program)) {
    for (const { local } of info.locals) names.add(local);
  }

  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration === null || declaration === undefined) continue;

    if (declaration.type === "VariableDeclaration") {
      for (const declarator of declaration.declarations) {
        if (declarator.id.type === "Identifier") names.add(declarator.id.name);
      }
    } else if (
      (declaration.type === "FunctionDeclaration" ||
        declaration.type === "ClassDeclaration" ||
        declaration.type === "TSInterfaceDeclaration" ||
        declaration.type === "TSTypeAliasDeclaration" ||
        declaration.type === "TSEnumDeclaration") &&
      declaration.id
    ) {
      names.add(declaration.id.name);
    }
  }

  return names;
};

export const findConstInit = (
  program: Program,
  name: string,
): Expression | null => {
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration"
        ? statement.declaration
        : statement;
    if (declaration?.type !== "VariableDeclaration") continue;

    for (const declarator of declaration.declarations) {
      if (
        declarator.id.type === "Identifier" &&
        declarator.id.name === name &&
        declarator.init
      ) {
        return declarator.init;
      }
    }
  }

  return null;
};

export const isExported = (program: Program, name: string): boolean =>
  program.body.some(statement => {
    if (statement.type !== "ExportNamedDeclaration") return false;
    if (statement.declaration?.type === "VariableDeclaration") {
      return statement.declaration.declarations.some(
        declarator =>
          declarator.id.type === "Identifier" && declarator.id.name === name,
      );
    }

    return statement.specifiers.some(
      specifier =>
        specifier.exported.type === "Identifier" &&
        specifier.exported.name === name,
    );
  });

const compareSpecifiers = (a: string, b: string): number =>
  a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

const importKind = (specifier: string): number =>
  specifier.startsWith(".") ? 2 : specifier.startsWith("@/") ? 1 : 0;

export const addNamedImport = (
  parsed: ParsedSource,
  specifier: string,
  name: string,
  { type = false }: { type?: boolean } = {},
): Edit[] => {
  const { program, source } = parsed;
  const imports = listImports(program);

  const existing = imports.find(
    info =>
      info.source === specifier &&
      info.isType === type &&
      info.declaration.specifiers.every(s => s.type === "ImportSpecifier") &&
      info.declaration.specifiers.length > 0,
  );

  if (existing !== undefined) {
    if (existing.locals.some(local => local.local === name)) return [];
    const specifiers = existing.declaration.specifiers;

    const next = specifiers.find(
      specifier => compareSpecifiers(specifier.local.name, name) > 0,
    );
    if (next !== undefined) {
      return [{ end: next.start, start: next.start, text: `${name}, ` }];
    }

    const last = specifiers[specifiers.length - 1];
    if (last === undefined) return [];

    const comma = commaAfter(source, last.end);

    return [
      comma === null
        ? { end: last.end, start: last.end, text: `, ${name}` }
        : { end: comma, start: comma, text: ` ${name},` },
    ];
  }

  const statement = `import ${type ? "type " : ""}{ ${name} } from ${JSON.stringify(specifier)};`;
  const kind = importKind(specifier);
  const sameKind = imports.filter(
    info => info.isType === type && importKind(info.source) === kind,
  );

  const before = sameKind.find(
    info => compareSpecifiers(info.source, specifier) > 0,
  );
  if (before !== undefined) {
    const at = startOfLineCommentsAbove(
      source,
      lineStart(source, before.declaration.start),
    );

    return [{ end: at, start: at, text: `${statement}\n` }];
  }

  const anchor = sameKind[sameKind.length - 1] ?? imports[imports.length - 1];

  if (anchor === undefined) {
    const directives = program.body.filter(
      statement =>
        statement.type === "ExpressionStatement" &&
        typeof (statement as { directive?: unknown }).directive === "string",
    );
    const last = directives[directives.length - 1];

    return last === undefined
      ? [{ end: 0, start: 0, text: `${statement}\n\n` }]
      : [{ end: last.end, start: last.end, text: `\n\n${statement}` }];
  }

  const separator = sameKind.length > 0 ? "\n" : "\n\n";

  return [
    {
      end: anchor.declaration.end,
      start: anchor.declaration.end,
      text: `${separator}${statement}`,
    },
  ];
};
