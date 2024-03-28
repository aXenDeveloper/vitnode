"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { PermissionsTopicForums } from "@/graphql/hooks";
import { useDeletePost } from "@/hooks/forum/posts/delete/use-delete-post";

interface Props {
  id: number;
  permissions: PermissionsTopicForums;
  state: {
    locked: boolean;
  };
}

export const ActionsPost = ({
  id,
  permissions: { can_edit },
  state
}: Props) => {
  const t = useTranslations("forum.topics.actions");
  const tCore = useTranslations("core");
  const { deletePost } = useDeletePost({ id: id });
  const editPost = async () => {
    throw new Error("Not implemented yet");
  };

  if (!can_edit) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" ariaLabel={t("title")}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-40">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={editPost}>
            <Pencil />
            {tCore("edit")}
          </DropdownMenuItem>

          <DropdownMenuItem onClick={deletePost} className="text-destructive">
            <Trash2 />
            {tCore("delete")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};