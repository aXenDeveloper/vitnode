import type {
  ClipboardEvent,
  CompositionEvent,
  HTMLAttributes,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  Ref,
  SyntheticEvent,
} from "react";

import { cn } from "cn";
import {
  Children,
  cloneElement,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTranslations } from "use-intl";

import type { ContentFieldDescriptor } from "../../content/types";
import type { InlineFieldSnapshot } from "./state";

import { humanizeFieldName } from "../../content/admin/labels";
import { useVisualEditor } from "../context";
import { useEditorInlineBlock } from "./context";
import { clipboardPlainText, domInlineText } from "./plain-text";
import {
  inlineFieldCommit,
  inlineFieldKind,
  inlineFieldRestore,
  inlineFieldSnapshot,
  inlineFieldText,
} from "./state";

type InlineChildProps = HTMLAttributes<HTMLElement> & {
  [attribute: `data-${string}`]: string | undefined;
  ref?: Ref<HTMLElement>;
};

const INLINE_FIELD_CLASS =
  "focus-visible:ring-ring pointer-events-auto relative z-20 rounded-sm outline-none before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-vitnode-inline-placeholder)] focus-visible:ring-2";

const warned = new Set<string>();

const warn = (key: string, message: string): void => {
  if (process.env.NODE_ENV === "production" || warned.has(key)) return;

  warned.add(key);
  // eslint-disable-next-line no-console
  console.warn(`\x1b[34m[VitNode]\x1b[0m \x1b[33m${message}\x1b[0m`);
};

const writeText = (element: HTMLElement, text: string): void => {
  const first = element.firstChild;

  if (
    text !== "" &&
    first !== null &&
    first.nodeType === Node.TEXT_NODE &&
    element.childNodes.length === 1
  ) {
    first.nodeValue = text;

    return;
  }

  element.textContent = text;
};

const caretOffset = (element: HTMLElement): number => {
  const selection = element.ownerDocument.defaultView?.getSelection();

  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);

  if (!element.contains(range.endContainer)) return 0;

  const measured = range.cloneRange();

  measured.selectNodeContents(element);
  measured.setEnd(range.endContainer, range.endOffset);

  return measured.toString().length;
};

const placeCaret = (element: HTMLElement, offset: number): void => {
  const selection = element.ownerDocument.defaultView?.getSelection();

  if (!selection) return;

  const range = element.ownerDocument.createRange();
  const first = element.firstChild;

  if (first?.nodeType === Node.TEXT_NODE) {
    range.setStart(first, Math.min(offset, first.nodeValue?.length ?? 0));
    range.collapse(true);
  } else {
    range.selectNodeContents(element);
    range.collapse(false);
  }

  selection.removeAllRanges();
  selection.addRange(range);
};

const insertTextAtCaret = (element: HTMLElement, value: string): void => {
  const owner = element.ownerDocument;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const native = owner.execCommand;

  if (
    typeof native === "function" &&
    native.call(owner, "insertText", false, value)
  ) {
    return;
  }

  const selection = owner.defaultView?.getSelection();
  const range =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  if (range === null || !element.contains(range.commonAncestorContainer)) {
    writeText(element, `${element.textContent ?? ""}${value}`);

    return;
  }

  range.deleteContents();

  const inserted = owner.createTextNode(value);

  range.insertNode(inserted);
  range.setStartAfter(inserted);
  range.collapse(true);
  selection?.removeAllRanges();
  selection?.addRange(range);
};

const failsFieldRules = (
  descriptor: ContentFieldDescriptor | undefined,
  text: string,
): boolean => {
  if (
    descriptor === undefined ||
    (descriptor.kind !== "text" && descriptor.kind !== "textarea")
  ) {
    return false;
  }

  if (descriptor.required && text.trim().length === 0) return true;

  if (
    descriptor.minLength !== undefined &&
    text.length > 0 &&
    text.length < descriptor.minLength
  ) {
    return true;
  }

  return (
    descriptor.maxLength !== undefined && text.length > descriptor.maxLength
  );
};

export interface InlineEditableTextProps {
  children: ReactNode;
  name: string;
  placeholder?: string;
}

export const InlineEditableText = ({
  children,
  name,
  placeholder,
}: InlineEditableTextProps): ReactElement => {
  const t = useTranslations("core.editor");
  const { dispatch } = useVisualEditor();
  const block = useEditorInlineBlock();
  const composingRef = useRef(false);
  const snapshotRef = useRef<InlineFieldSnapshot | null>(null);

  const definition = block?.definition;
  const kind = inlineFieldKind(definition, name);
  const text = block === null ? "" : inlineFieldText(block.instance.data, name);
  const editable = definition !== undefined && kind !== null;
  const registerField = block?.registerField;

  const only =
    Children.count(children) === 1 ? Children.toArray(children)[0] : null;
  const onlyElement = isValidElement<InlineChildProps>(only) ? only : null;
  const childElement =
    onlyElement !== null && typeof onlyElement.type === "string"
      ? onlyElement
      : null;
  const [element, setMounted] = useState<HTMLElement | null>(null);

  const setElement = useCallback((node: HTMLElement | null): void => {
    setMounted(node);
  }, []);

  useEffect(() => {
    if (!editable || registerField === undefined) return undefined;

    return registerField();
  }, [editable, registerField]);

  useLayoutEffect(() => {
    if (element === null || kind === null || composingRef.current) return;
    if (domInlineText(kind, element) === text) return;

    if (element.ownerDocument.activeElement !== element) {
      writeText(element, text);

      return;
    }

    const offset = caretOffset(element);

    writeText(element, text);
    placeCaret(element, Math.min(offset, text.length));
  }, [element, kind, text]);

  if (block === null) return <>{children}</>;

  const { instance, nodeRef } = block;

  if (definition === undefined || kind === null) {
    warn(
      `inline-kind:${instance.type}:${name}`,
      `Block "${instance.type}" marks the field "${name}" for inline editing, but only field.text() and field.textarea() can be typed into on the page. It is rendered exactly as the block draws it and stays editable in the Properties panel.`,
    );

    return <>{children}</>;
  }

  const descriptor: ContentFieldDescriptor | undefined =
    definition.fields[name];
  const fieldLabel = humanizeFieldName(name);
  const blockName = definition.name ?? instance.type;
  const invalid = failsFieldRules(descriptor, text);

  const commit = (next: string): void => {
    dispatch({
      ...inlineFieldCommit(definition, name, next),
      ref: nodeRef,
      type: "update",
    });
  };

  const endEditing = (element: HTMLElement): void => {
    snapshotRef.current = null;
    element.blur();
  };

  const handleInput = (event: SyntheticEvent<HTMLElement>): void => {
    if (composingRef.current) return;

    commit(domInlineText(kind, event.currentTarget));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (composingRef.current || event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      const snapshot = snapshotRef.current;

      if (snapshot !== null) {
        dispatch({
          ...inlineFieldRestore(snapshot),
          ref: nodeRef,
          type: "update",
        });
      }

      endEditing(event.currentTarget);

      return;
    }

    if (kind === "text" && event.key === "Enter") {
      event.preventDefault();
      commit(domInlineText(kind, event.currentTarget));
      endEditing(event.currentTarget);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLElement>): void => {
    event.preventDefault();

    const element = event.currentTarget;

    insertTextAtCaret(element, clipboardPlainText(kind, event.clipboardData));
    commit(domInlineText(kind, element));
  };

  const handleFocus = (): void => {
    snapshotRef.current = inlineFieldSnapshot(instance.data, name);
    dispatch({ ref: nodeRef, type: "select" });
  };

  const handleBlur = (): void => {
    snapshotRef.current = null;
  };

  const handleCompositionStart = (): void => {
    composingRef.current = true;
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLElement>): void => {
    composingRef.current = false;
    commit(domInlineText(kind, event.currentTarget));
  };

  const injected: InlineChildProps = {
    "aria-label": t("inline.label", { field: fieldLabel, name: blockName }),
    "aria-multiline": kind === "textarea",
    className: cn(
      kind === "textarea" ? "whitespace-pre-wrap" : undefined,
      childElement?.props.className,
      INLINE_FIELD_CLASS,
    ),
    contentEditable: "plaintext-only",
    "data-vitnode-inline-field": name,
    "data-vitnode-inline-placeholder":
      placeholder ?? t("inline.empty", { field: fieldLabel }),
    onBlur: handleBlur,
    onCompositionEnd: handleCompositionEnd,
    onCompositionStart: handleCompositionStart,
    onCompositionUpdate: handleCompositionStart,
    onFocus: handleFocus,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    ref: setElement,
    role: "textbox",
    suppressContentEditableWarning: true,
    tabIndex: 0,
    ...(invalid ? { "aria-invalid": true, title: t("inline.invalid") } : {}),
  };

  if (childElement === null) {
    if (onlyElement !== null && onlyElement.type !== Fragment) {
      warn(
        `inline-component:${instance.type}:${name}`,
        `Block "${instance.type}" wraps the field "${name}" in <BlockField> around a component rather than an element. The editor writes the text into a real DOM node, and it cannot reach inside a component to find one, so the field is rendered exactly as the block draws it and stays editable in the Properties panel. Wrap the element that component renders - <h1>{data.${name}}</h1> - to type into it on the page.`,
      );

      return <>{children}</>;
    }

    warn(
      `inline-shape:${instance.type}:${name}`,
      `Block "${instance.type}" wraps the field "${name}" in <BlockField> around something other than one element, so a <span> is wrapped around it to make it editable. Wrap the element the field already renders - <h1>{data.${name}}</h1> - and the page keeps its own markup.`,
    );

    return <span {...injected} />;
  }

  // eslint-disable-next-line react-hooks/refs
  return cloneElement(childElement, injected, null);
};
