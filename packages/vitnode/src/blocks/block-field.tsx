import type { ReactNode } from "react";

import { useBlockInlineRuntime } from "./inline-context";

export interface BlockFieldProps {
  children: ReactNode;
  name: string;
  placeholder?: string;
}

export interface BlockFieldNamedProps<TName extends string> {
  children: ReactNode;
  name: TName;
  placeholder?: string;
}

export type BlockFieldComponent<TName extends string> = (
  props: BlockFieldNamedProps<TName>,
) => ReactNode;

export const BlockField = ({
  children,
  name,
  placeholder,
}: BlockFieldProps): ReactNode => {
  const runtime = useBlockInlineRuntime();

  if (!runtime) return children;

  return runtime.render({ children, name, placeholder });
};

export const WidgetField = BlockField;

export const blockFieldsFor = <TFields,>(): BlockFieldComponent<
  Extract<keyof TFields, string>
> => BlockField as BlockFieldComponent<Extract<keyof TFields, string>>;

export const widgetFieldsFor = blockFieldsFor;

export type WidgetFieldProps = BlockFieldProps;
export type WidgetFieldNamedProps<TName extends string> =
  BlockFieldNamedProps<TName>;
export type WidgetFieldComponent<TName extends string> =
  BlockFieldComponent<TName>;
