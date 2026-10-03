import React from "react";

import type { TipTapEditorProps } from "@/components/tiptap/tiptap-editor";

import { Spinner } from "./spinner";

const TipTapEditor = React.lazy(async () =>
  import("@/components/tiptap/tiptap-editor").then(module => ({
    default: module.TipTapEditor,
  })),
);

const subscribeNever = () => () => {};
const getIsHydrated = () => true;
const getIsHydratedOnServer = () => false;

export const Editor = (props: TipTapEditorProps) => {
  const isHydrated = React.useSyncExternalStore(
    subscribeNever,
    getIsHydrated,
    getIsHydratedOnServer,
  );

  if (!isHydrated)
    return (
      <div className="flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );

  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Spinner size="xl" />
        </div>
      }
    >
      <TipTapEditor {...props} />
    </React.Suspense>
  );
};
