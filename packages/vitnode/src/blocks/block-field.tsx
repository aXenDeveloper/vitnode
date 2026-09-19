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

export const blockFieldsFor = <TFields,>(): BlockFieldComponent<
  Extract<keyof TFields, string>
> => BlockField as BlockFieldComponent<Extract<keyof TFields, string>>;
