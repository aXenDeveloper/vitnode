"use client";

import { FileIcon } from "lucide-react";
import React from "react";

export const FilePreview = ({
  mimeType,
  name,
  url,
}: {
  mimeType: null | string;
  name: string;
  url: null | string;
}) => {
  const [failed, setFailed] = React.useState(false);
  const isImage = !!url && !failed && (mimeType?.startsWith("image/") ?? false);

  if (!isImage) {
    return (
      <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
        <FileIcon className="size-4" />
      </div>
    );
  }

  return (
    <img
      alt={name}
      className="bg-muted size-10 rounded-md object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
      src={url}
    />
  );
};
