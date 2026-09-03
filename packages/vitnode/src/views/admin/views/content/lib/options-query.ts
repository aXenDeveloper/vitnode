import { useQueryClient } from "@tanstack/react-query";
import React from "react";

import type { ContentFormFieldSpec } from "@/content/admin/spec";

import {
  CONTENT_USER_TARGET,
  contentOptionsQueryKey as contentOptionsKeyFor,
  contentOptionsQueryRoot,
} from "../content-query";

/** What a picker offers: a content type's rows, or people. */
export const contentOptionsTarget = (spec: ContentFormFieldSpec): string =>
  spec.targetContentTypeId ?? CONTENT_USER_TARGET;

export const contentOptionsQueryKey = (
  spec: ContentFormFieldSpec,
  locale: string,
): readonly unknown[] =>
  contentOptionsKeyFor(contentOptionsTarget(spec), spec.name, locale);

export const contentOptionsQueryKeyFor = (
  contentTypeId: string,
): readonly unknown[] => contentOptionsQueryRoot(contentTypeId);

export const useInvalidateContentOptions = (): ((
  contentTypeId: string,
) => void) => {
  const queryClient = useQueryClient();

  return React.useCallback(
    (contentTypeId: string) => {
      queryClient.removeQueries({
        queryKey: contentOptionsQueryRoot(contentTypeId),
      });
    },
    [queryClient],
  );
};
