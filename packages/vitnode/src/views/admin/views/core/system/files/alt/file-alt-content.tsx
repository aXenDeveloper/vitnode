import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import React from "react";

import type { AdminMutationResult } from "@/views/admin/views/core/shared/admin-mutation";

import { FileAltEditor } from "./file-alt-editor";
import {
  fileAltQueryKey,
  fileAltQueryOptions,
  removeFileAlt,
  saveFileAlt,
  saveFileAltPolicy,
} from "./file-alt-query";

/** The dialog's body: one image's ALT text, loaded when the dialog opens. */
export const FileAltContent = ({
  canEdit,
  fileId,
}: {
  canEdit: boolean;
  fileId: number;
}) => {
  const queryClient = useQueryClient();
  const { data } = useSuspenseQuery(fileAltQueryOptions(fileId));

  const handlers = React.useMemo(() => {
    const settled = async (
      write: Promise<AdminMutationResult<true>>,
    ): Promise<AdminMutationResult<true>> => {
      const result = await write;
      if ("data" in result) {
        await queryClient.invalidateQueries({
          queryKey: fileAltQueryKey(fileId),
        });
      }

      return result;
    };

    return {
      onPolicyChange: async (policy: Parameters<typeof saveFileAltPolicy>[1]) =>
        await settled(saveFileAltPolicy(fileId, policy)),
      onRemove: async (languageCode: string) =>
        await settled(removeFileAlt(fileId, languageCode)),
      onSave: async (body: { languageCode: string; text: string }) =>
        await settled(saveFileAlt(fileId, body)),
    };
  }, [fileId, queryClient]);

  return <FileAltEditor canEdit={canEdit} data={data} {...handlers} />;
};
